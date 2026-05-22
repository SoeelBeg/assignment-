const express = require("express");
const crypto = require("crypto");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const db = require("./db");

const app = express();
app.use(express.json());

const SECRET = "nestack_secret";

const retrySchedule = [
  30000,
  300000,
  1800000
];

async function deliverEvent(event) {

  try {

    const signature = crypto
      .createHmac("sha256", SECRET)
      .update(event.payload)
      .digest("hex");

    const response = await axios.post(
      event.webhook_url,
      JSON.parse(event.payload),
      {
        timeout: 5000,
        headers: {
          "X-Webhook-Signature": signature
        }
      }
    );

    const success =
      response.status >= 200 &&
      response.status < 300;

    db.run(`
      INSERT INTO attempts
      (event_id, attempted_at, http_status, outcome)
      VALUES (?, ?, ?, ?)
    `,
    [
      event.id,
      new Date().toISOString(),
      response.status,
      success ? "success" : "failed"
    ]);

    if (success) {

      db.run(`
        UPDATE events
        SET status='delivered'
        WHERE id=?
      `, [event.id]);

    }

  } catch (err) {

    db.run(`
      INSERT INTO attempts
      (event_id, attempted_at, http_status, outcome)
      VALUES (?, ?, ?, ?)
    `,
    [
      event.id,
      new Date().toISOString(),
      err.response?.status || null,
      "failed"
    ]);

    const retries = event.retry_count + 1;

    if (retries > 3) {

      db.run(`
        UPDATE events
        SET status='dead',
            retry_count=?
        WHERE id=?
      `, [retries, event.id]);

    } else {

      const nextRetry =
        Date.now() + retrySchedule[retries - 1];

      db.run(`
        UPDATE events
        SET status='failed',
            retry_count=?,
            next_retry=?
        WHERE id=?
      `,
      [retries, nextRetry, event.id]);

    }

  }

}

global.deliverEvent = deliverEvent;

app.post("/events", (req, res) => {

  const { type, payload, webhook_url } = req.body;

  const event = {
    id: uuidv4(),
    type,
    payload: JSON.stringify(payload),
    webhook_url,
    status: "pending",
    retry_count: 0,
    next_retry: Date.now(),
    created_at: new Date().toISOString()
  };

  db.run(`
    INSERT INTO events
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  [
    event.id,
    event.type,
    event.payload,
    event.webhook_url,
    event.status,
    event.retry_count,
    event.next_retry,
    event.created_at
  ]);

  deliverEvent(event);

  res.status(201).json(event);

});

app.get("/events", (req, res) => {

  db.all(`
    SELECT * FROM events
  `, [], (err, rows) => {

    const data = rows.map(r => ({
      ...r,
      payload: JSON.parse(r.payload)
    }));

    res.json(data);

  });

});

app.get("/events/:id", (req, res) => {

  db.get(`
    SELECT * FROM events
    WHERE id=?
  `,
  [req.params.id],
  (err, event) => {

    if (!event)
      return res.status(404).json({
        message: "Not found"
      });

    db.all(`
      SELECT * FROM attempts
      WHERE event_id=?
    `,
    [event.id],
    (err, attempts) => {

      res.json({
        ...event,
        payload: JSON.parse(event.payload),
        attempts
      });

    });

  });

});

app.post("/events/:id/retry", (req, res) => {

  db.get(`
    SELECT * FROM events
    WHERE id=?
  `,
  [req.params.id],
  (err, event) => {

    if (!event)
      return res.status(404).json({
        message: "Not found"
      });

    if (event.status !== "dead") {

      return res.status(400).json({
        message: "Event is not dead"
      });

    }

    db.run(`
      UPDATE events
      SET status='pending',
          retry_count=0,
          next_retry=?
      WHERE id=?
    `,
    [Date.now(), event.id]);

    res.json({
      message: "Requeued"
    });

  });

});

app.listen(3000, () => {
  console.log("Server running");
});