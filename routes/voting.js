const express = require("express");
const router = express.Router();
const { database } = require("../config");

router.get(`/voters/:campus_id`, (req, res) => {
  const { campus_id } = req.params;
  database
    // .orderBy("id")
    .select(
      "name",
      "stdno",
      "r_time",
      "campus.campus_name",
      "voter_stdno",
      "userfull_name",
      "cam_id"
    )
    .from("voters")
    .leftJoin(
      "students_biodata",
      "voters.voter_stdno",
      "students_biodata.stdno"
    )
    .join("users", "voters.registered_by", "users.id")
    .join("campus", "voters.campus", "campus.campus_name")
    .where("campus.cam_id", "=", campus_id)
    .then((data) => {
      // console.log("result againt", data);
      res.send(data);
    });
});

router.get("/myRegisteredStudents/:user_id", (req, res) => {
  const { user_id } = req.params;
  console.log(user_id);
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  database("voters")
    .select("*")
    .where({
      registered_by: user_id,
      r_date: date,
    })
    .then((data) => {
      res.send(`${data.length}`);
    });
});

router.get("/voter/:studentNo", (req, res) => {
  const { studentNo } = req.params;
  const userId = 1;
  console.log("number", studentNo);
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  database
    .select("*")
    .from("voters")
    .where({
      voter_stdno: studentNo,
      r_date: date,
    })
    .then((result) => {
      database
        .select("*")
        .from("constraints")
        .where("c_name", "=", "Voting")
        .then((result2) => {
          if (result.length) {
            console.log("true------");
            res.send({
              alreadyVoted: "true",
              requiredPercentage: result2[0].c_percentage,
            });
          } else {
            console.log("False-----");
            res.send({
              alreadyVoted: "false",
              requiredPercentage: result2[0].c_percentage,
            });
          }
          console.log("The percentage ", result2[0].c_percentage);
        });
    });
});

router.post("/addVoter", (req, res) => {
  const { studentNo, registered_by, campus } = req.body;
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  const time = d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();
  //console.log(req.body);

  //first checking if voter exists
  database
    .select("*")
    .from("voters")
    .where({
      voter_stdno: studentNo,
      r_date: date,
    })
    .then((result) => {
      if (result.length === 0) {
        //No voter with such credentials
        //adding him
        database("voters")
          .insert({
            voter_stdno: studentNo,
            registered_by,
            r_time: time,
            r_date: date,
            campus: campus,
          })
          .then((data) => res.status(200).send("Received voter data"))
          .catch((err) =>
            res.status(400).send("Failed to send the data " + err)
          );
      } else {
        res.send("Voter already voted");
      }
    });
});

module.exports = router;
