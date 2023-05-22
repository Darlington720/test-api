const baseIp = "199.241.139.118";
var knex = require("knex");
const port = 9000;

const database = knex({
  client: "mysql",
  connection: {
    host: "127.0.0.1",
    user: "phpmyadmin",
    password: "t9r8pUewXE",
    database: "nkumba",
  },
});

module.exports = {
  baseIp,
  port,
  database,
};
