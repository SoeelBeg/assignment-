const db = require("./db");
require("./server");

setInterval(() => {

  db.all(`
    SELECT * FROM events
    WHERE status IN ('pending', 'failed')
    AND next_retry <= ?
  `,
  [Date.now()],
  async (err, events) => {

    for (const event of events) {

      await global.deliverEvent(event);

    }

  });

}, 5000);