const express = require("express");
const path = require("path");
const router = express.Router();
const multer = require("multer");
const { database } = require("../config");

// Configure multer to store uploaded files in a desired location
const storage = multer.diskStorage({
  destination: path.resolve(__dirname, "..", "upload/evidence"),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

router.get("/student/:stdno", async (req, res) => {
  const { stdno } = req.params;
  let year;
  let sem;
  let student_cus = [];
  let registration_status = "Not Registered";
  const student = await database.select("*").from("students_biodata").where({
    stdno,
  });

  if (!student[0]) {
    return res.send({
      success: false,
      message: `Unknown Student ${stdno}`,
    });
  }

  year = student[0].study_yr;
  sem = student[0].current_sem;

  const payments = await database.select("*").from("student_paid_fess").where({
    stu_no: stdno,
  });

  payments.sort((a, b) => {
    // Sort by 'study_yr' first
    if (a.study_yr < b.study_yr) {
      return -1;
    }
    if (a.study_yr > b.study_yr) {
      return 1;
    }

    // If 'study_yr' is the same, sort by 'sem'
    if (a.sem < b.sem) {
      return -1;
    }
    if (a.sem > b.sem) {
      return 1;
    }

    // If both 'study_yr' and 'sem' are equal, maintain the original order
    return 0;
  });

  // active payments - pick the current yr and sem
  if (payments.length > 0) {
    year = payments[payments.length - 1].study_yr;
    sem = payments[payments.length - 1].sem;
    registration_status = payments[payments.length - 1].reg_status;
  }

  // booklet numbers for the student
  const course_units_did_by_student = await database
    .select("*")
    .from("students_in_exam_room")
    .join(
      "courseunits_in_exam_rooms",
      "students_in_exam_room.cu_in_ex_id",
      "=",
      "courseunits_in_exam_rooms.cunit_in_ex_room_id"
    )
    .join(
      "exam_details",
      "courseunits_in_exam_rooms.ed_id",
      "=",
      "exam_details.ed_id"
    )
    .andWhere("students_in_exam_room.stu_no", "=", stdno);
  // .groupBy("course_unit_code");
  //console.log("payments", payments)
  //exemptions
  const studentExemptions = await database
    .select("*")
    .from("exemptions")
    .where("stdno", "=", stdno);

  console.log("course units did in room", course_units_did_by_student);

  // const enrolledModules = await database
  //   .select("*")
  //   .from("student_enrollment_categories")
  //   .join(
  //     "student_enrolled_modules",
  //     "student_enrollment_categories.sec_id",
  //     "student_enrolled_modules.cat_id"
  //   )
  //   .where("student_enrollment_categories.stdno", "=", stdno)
  //   .andWhere("student_enrollment_categories.study_yr", "=", year)
  //   .andWhere("student_enrollment_categories.sem", "=", sem);

  const enrolledModules = await database
    // .orderBy("id")
    .select("*")
    .from("modules")
    .where({
      module_code: student[0].progcode,
    });

  if (!course_units_did_by_student[0]) {
    //	console.log("year", year);
    //	console.log("sem", sem);
    return res.send({
      success: true,
      result: {
        biodata: student[0],
        payments,
        study_yr: year,
        current_sem: sem,
        registration_status,
        student_cus: studentExemptions,
        enrolledModules,
      },
    });
  }
  const x = course_units_did_by_student.map(async (cu) => {
    const booklets = await database
      .select("*")
      .from("student_registered_booklets")
      .where({
        stu_in_ex_room_id: cu.se_id,
      });

    return student_cus.push({ ...cu, booklets });
  });

  Promise.all(x)
    .then(() => {
      res.send({
        success: true,
        result: {
          biodata: student[0],
          payments,
          study_yr: year,
          current_sem: sem,
          registration_status,
          student_cus: [...student_cus, ...studentExemptions],
          enrolledModules,
        },
      });
    })
    .catch((err) => {
      res.send({
        success: false,
        message: "Error handling the request" + err,
      });
    });
});

router.post("/end_room_session", async (req, res) => {
  const { ed_id, staff_id } = req.body;

  console.log("Receiving ", req.body);

  const d = new Date();
  const formatedDate =
    d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  console.log("Formated", formatedDate);
  console.log("Formated time", d.toLocaleTimeString());

  try {
    const room_details_update = await database
      .select("*")
      .from("exam_details")
      .where({
        ed_id,
      })
      .update({
        ended_at: d.toLocaleTimeString(),
        ended_by: staff_id,
      });

    res.send({
      success: true,
      message: "Successfully ended the session",
    });
  } catch (error) {
    res.send({
      success: false,
      message: "error updating the session data" + error,
    });
  }
});

router.post("/api/saveRegisteredModule", (req, res) => {
  // const { room, invigilators, session, date, status, assigned_by } = req.body;
  // console.log("Data Received", req.body);

  const d1 = new Date(req.body.assigned_date);
  const assignedDate =
    d1.getFullYear() + "-" + (d1.getMonth() + 1) + "-" + d1.getDate();

  const d = new Date();
  const formatedDate =
    d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  console.log("Formated", formatedDate);
  console.log("Formated time", d.toLocaleTimeString());

  database("modules_registered")
    .insert({
      module_code: req.body.module_code,
      module_title: req.body.module_title,
      module_sem: req.body.module_sem,
      module_status: req.body.module_status,
      module_year: req.body.module_year,
      yrsem: req.body.yrsem,
      credit_units: req.body.credit_units,
      stdno: req.body.stdno,
      registered_by: req.body.registered_by,
      time_in: d.toLocaleTimeString(),
      date_start: formatedDate,
    })
    .then((data) => {
      //checking if any student has already come for the specified unit
      database
        .select("*")
        .from("courseunits_in_exam_rooms")
        .where({
          module_code: req.body.module_code,
          module_title: req.body.module_title,
          room_id: req.body.room_id,
          session_id: req.body.session_id,
          assigned_date: assignedDate,
        })
        .then((data) => {
          if (data.length == 0) {
            database("courseunits_in_exam_rooms")
              .insert({
                module_code: req.body.module_code,
                module_title: req.body.module_title,
                room_id: req.body.room_id,
                session_id: req.body.session_id,
                assigned_date: assignedDate,
              })
              .then((data) => {
                console.log("Saved that course unit");
              });
          }
        });

      res.status(200).send("received the data");
    })
    .catch((err) => res.status(400).send("Failed to send the data " + err));
});

router.post("/examHandin", async (req, res) => {
  // const { room, invigilators, session, date, status, assigned_by } = req.body;
  console.log("Data Received for handin", req.body);
  const d = new Date();
  const formatedDate =
    d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  console.log("Formated", formatedDate);
  console.log("Formated time", d.toLocaleTimeString());

  try {
    const insert = await database("students_in_exam_room")
      .where({
        se_id: req.body.se_id,
      })
      .update({
        handed_in: 1,
        time_handin: d.toLocaleTimeString(),
        date_handin: formatedDate,
      });

    res.status(200).send({
      success: true,
      message: "received the data",
    });
  } catch (error) {
    res.status(400).send({
      success: false,
      message: "Failed to send the data " + error,
    });
  }
});

router.post("/addStudentBookletNos", async (req, res) => {
  // const { room, invigilators, session, date, status, assigned_by } = req.body;
  console.log("Data Received", req.body);
  const { stu_no, bookletNos, course_unit_name, course_code, ed_id, staff_id } =
    req.body;
  let existingUnit_id;
  let existingStuInRoom_id;

  // first we are going to save the required data in course_units_in_exam_room
  const existingUnit = await database
    .select("*")
    .from("courseunits_in_exam_rooms")
    .where({
      ed_id,
      module_code: course_code,
      module_title: course_unit_name,
    });

  if (!existingUnit[0]) {
    const insertResult = await database("courseunits_in_exam_rooms").insert({
      ed_id,
      module_code: course_code,
      module_title: course_unit_name,
    });
    existingUnit_id = insertResult[0];
  } else {
    existingUnit_id = existingUnit[0].cunit_in_ex_room_id;
  }

  // then insert the student_no in the students_in_exam_room table
  // but let me first check if there is an existing exact record
  const existingStudentInRoom = await database
    .select("*")
    .from("students_in_exam_room")
    .where({
      stu_no,
      cu_in_ex_id: existingUnit_id,
      staff_id,
    });

  // console.log(existingStudentInRoom);

  if (!existingStudentInRoom[0]) {
    const insertStuResult = await database("students_in_exam_room").insert({
      stu_no,
      cu_in_ex_id: existingUnit_id,
      staff_id,
    });
    existingStuInRoom_id = insertStuResult[0];
  } else {
    existingStuInRoom_id = existingStudentInRoom[0].se_id;
  }

  // then insert the booklet numbers in student_registered_booklets table
  const x = bookletNos.map(async (b) => {
    const existingBooklet = await database
      .select("*")
      .from("student_registered_booklets")
      .where({
        stu_in_ex_room_id: existingStuInRoom_id,
        booklet_no: b.booklet_no,
      });

    if (existingBooklet.length == 0) {
      const insertBooklet = await database(
        "student_registered_booklets"
      ).insert({
        stu_in_ex_room_id: existingStuInRoom_id,
        booklet_no: b.booklet_no,
      });

      // const entireBooklet = await database
      // .select("*")
      // .from("student_registered_booklets")
      // .where({
      //   srb_id: insertBooklet[0],
      // });

      // .catch((err) =>
      //   res.status(400).send("Failed to send the data " + err)
      // );
    }
  });

  Promise.all(x)
    .then(() => {
      res.send({
        success: true,
        message: "Successfully Saved the data",
      });
    })
    .catch((err) => {
      res.send({
        success: false,
        message: "Error storing booklet number " + err,
      });
    });
});

router.get("/api/getStudentRegBookletNos/:moduleRegId", (req, res) => {
  // const { room, invigilators, session, date, status, assigned_by } = req.body;
  const { moduleRegId } = req.params;
  console.log("Data Received", req.params);
  const d = new Date();
  const formatedDate =
    d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  database
    .select("*")
    .from("student_registered_booklets")
    .where({
      module_reg_id: moduleRegId,
    })
    .then((data) => {
      res.send(data);
    });
});

router.get("/api/getStudentRegisteredModules/:studentNo", (req, res) => {
  const { studentNo } = req.params;

  console.log("Student data", studentNo);
  database
    .select("*")
    .from("modules_registered")
    .leftJoin(
      "students_handin",
      "modules_registered.cunit_reg_id",
      "=",
      "students_handin.module_reg_id"
    )

    .where("modules_registered.stdno", "=", studentNo)

    .then((data) => {
      database
        .select("*")
        .from("exemptions")
        .where({
          stdno: studentNo,
        })
        .then((data2) => {
          res.send([...data, ...data2]);
        });
    });
});

router.get("/examsDidInRoom/:ed_id", async (req, res) => {
  // const { room, invigilators, session, date, status, assigned_by } = req.body;
  // console.log("Data Received in room", req.body);

  const { ed_id } = req.params;
  let num_of_students = [];
  // first am using the `ed_id` to get all the course units did the room
  const courseUnitsDidInRoom = await database
    .select("*")
    .from("courseunits_in_exam_rooms")
    .where({
      ed_id,
    });

  if (courseUnitsDidInRoom.length == 0) {
    return res.send({
      success: true,
      result: [],
    });
  }

  // am using each each unit to get the students from the `students_in_exam_room`
  const x = courseUnitsDidInRoom.map(async (cu) => {
    const studentCount = await database
      // .count("cu")
      .from("students_in_exam_room")
      .where({
        cu_in_ex_id: cu.cunit_in_ex_room_id,
      })
      .count("cu_in_ex_id as num_of_students");

    num_of_students.push({
      id: cu.cunit_in_ex_room_id,
      module_title: cu.module_title,
      studentCount,
    });
  });

  Promise.all(x).then(() => {
    res.send({
      success: true,
      result: { courseUnitsDidInRoom, students: num_of_students },
    });
  });

  // database
  //   .select("*")
  //   .from("courseunits_in_exam_rooms")
  //   .where({
  //     room_id: req.body.room_id,
  //     session_id: req.body.session_id,
  //     assigned_date: assignedDate,
  //   })
  //   .then((data) => {
  //     console.log("ney data", data);
  //     let newArr = [];

  //     if (data.length == 0) {
  //       res.send(data);
  //     } else {
  //       data.forEach((exam, index) => {
  //         let d4 = async (callback) => {
  //           await database
  //             .select("*")
  //             .from("modules_registered")
  //             .where({
  //               module_title: exam.course_unit_name,
  //             })
  //             .then((data4) => {
  //               // res.send(data);
  //               let data = async (callback) => {
  //                 await database
  //                   .select("*")
  //                   .from("modules_registered")
  //                   .join(
  //                     "students_handin",
  //                     "modules_registered.cunit_reg_id",
  //                     "=",
  //                     "students_handin.module_reg_id"
  //                   )

  //                   .where(
  //                     "modules_registered.module_title",
  //                     "=",
  //                     exam.course_unit_name
  //                   )
  //                   .then((data2) => {
  //                     // return result;
  //                     // console.log("result ", result);
  //                     let obj = {
  //                       registered: data4.length,
  //                       handed_in: data2.length,
  //                       didnt_handin: data4.length - data2.length,
  //                     };
  //                     newArr.push({ ...exam, ...obj });
  //                     callback(newArr);
  //                     // res = result;
  //                   });
  //               };

  //               data(function (result) {
  //                 // console.log("Call back result", result);
  //                 callback(result);
  //               });
  //             });
  //         };

  //         d4(function (result) {
  //           if (data.length - 1 == index) {
  //             res.send(result);
  //           }
  //           // console.log("Call back in loop now", result);
  //           // callback(result)
  //         });
  //       });
  //     }
  //   });
});

router.get("/students_in_exam/:id", async (req, res) => {
  const { id } = req.params;
  let num_of_students = [];
  // getting the students in the specificied exam
  const students_in_ex_room = await database

    .from("students_in_exam_room")
    .join(
      "students_biodata",
      "students_in_exam_room.stu_no",
      "=",
      "students_biodata.stdno"
    )
    .select("students_biodata.name", "students_in_exam_room.*")
    .where({
      cu_in_ex_id: id,
    });

  if (students_in_ex_room.length == 0) {
    return res.send({
      success: true,
      result: [],
    });
  }

  res.send({
    success: true,
    result: students_in_ex_room,
  });

  // database
  //   .select("*")
  //   .from("courseunits_in_exam_rooms")
  //   .where({
  //     room_id: req.body.room_id,
  //     session_id: req.body.session_id,
  //     assigned_date: assignedDate,
  //   })
  //   .then((data) => {
  //     console.log("ney data", data);
  //     let newArr = [];

  //     if (data.length == 0) {
  //       res.send(data);
  //     } else {
  //       data.forEach((exam, index) => {
  //         let d4 = async (callback) => {
  //           await database
  //             .select("*")
  //             .from("modules_registered")
  //             .where({
  //               module_title: exam.course_unit_name,
  //             })
  //             .then((data4) => {
  //               // res.send(data);
  //               let data = async (callback) => {
  //                 await database
  //                   .select("*")
  //                   .from("modules_registered")
  //                   .join(
  //                     "students_handin",
  //                     "modules_registered.cunit_reg_id",
  //                     "=",
  //                     "students_handin.module_reg_id"
  //                   )

  //                   .where(
  //                     "modules_registered.module_title",
  //                     "=",
  //                     exam.course_unit_name
  //                   )
  //                   .then((data2) => {
  //                     // return result;
  //                     // console.log("result ", result);
  //                     let obj = {
  //                       registered: data4.length,
  //                       handed_in: data2.length,
  //                       didnt_handin: data4.length - data2.length,
  //                     };
  //                     newArr.push({ ...exam, ...obj });
  //                     callback(newArr);
  //                     // res = result;
  //                   });
  //               };

  //               data(function (result) {
  //                 // console.log("Call back result", result);
  //                 callback(result);
  //               });
  //             });
  //         };

  //         d4(function (result) {
  //           if (data.length - 1 == index) {
  //             res.send(result);
  //           }
  //           // console.log("Call back in loop now", result);
  //           // callback(result)
  //         });
  //       });
  //     }
  //   });
});

router.post("/start_room_session", async (req, res) => {
  const { ed_id, staff_id } = req.body;

  console.log("Receiving ", req.body);

  const d = new Date();
  const formatedDate =
    d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  console.log("Formated", formatedDate);
  console.log("Formated time", d.toLocaleTimeString());

  try {
    const room_details_update = await database
      .select("*")
      .from("exam_details")
      .where({
        ed_id,
      })
      .update({
        started_at: d.toLocaleTimeString(),
        started_by: staff_id,
      });

    res.send({
      success: true,
      message: "Successfully initialized the session",
    });
  } catch (error) {
    res.send({
      success: false,
      message: "error updating the session data" + error,
    });
  }
});

router.post("/save_evidence", async (req, res) => {
  // Access the uploaded image details through req.files
  console.log("Images received:", req.files);
  const { stdno, ed_id, description, staff_id } = req.body;
  console.log("the body", {
    stdno,
    ed_id,
    description,
    staff_id,
  });

  let me_id;

  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send("No files were uploaded.");
  }

  const destinationDirectory = path.resolve(__dirname, "..", "upload/evidence");

  //first let me store the data that is in req.body
  const existingMalpractice = await database
    .select("*")
    .from("malpractice")
    .where({
      stdno,
      ed_id,
      description,
      staff_id,
    });

  console.log("existing id", existingMalpractice);

  if (!existingMalpractice[0]) {
    const insertResult = await database("malpractice").insert({
      stdno,
      ed_id,
      description,
      staff_id,
    });
    me_id = insertResult[0];
  } else {
    me_id = existingMalpractice[0].me_id;
  }

  console.log("desination", destinationDirectory);

  const x = Object.values(req.files).map(async (file) => {
    file.mv(
      path.join(destinationDirectory, `${Date.now()}-${file.name}`),
      (error) => {
        if (error) {
          console.error("Error moving file:", error);
        }
      }
    );

    return await database("malpractice_evidence").insert({
      me_id,
      image: `${Date.now()}-${file.name}`,
    });
  });

  // res.send("Images uploaded successfully!");
  Promise.all(x)
    .then(() => {
      res.send({
        success: true,
        message: "Images uploaded successfully!",
      });
    })
    .catch((err) => {
      console.log("Error", err);
      res.send({
        success: false,
        message: "error the images",
      });
    });
});

router.post("/exemption", async (req, res) => {
  const { stdno, module_code, module_title, exempted_by } = req.body;

  console.log("the body for exemption", req.body);

  // check for existing exemption
  const existingExemption = await database
    .select("*")
    .from("exemptions")
    .where({
      stdno,
      module_code,
      module_title,
      exempted_by,
    });

  if (existingExemption[0]) {
    return res.send({
      success: true,
      message: "Student already exempted!",
    });
  }

  if (!existingExemption[0]) {
    const insertResult = await database("exemptions").insert({
      stdno,
      module_code,
      module_title,
      exempted_by,
    });
  }

  res.send({
    success: true,
    message: "student exempted successfully",
  });
});

router.get("/students", async (req, res) => {
  let year;
  let sem;
  let arr = [];

  const allStudents = await database
    .select("stdno", "progcode", "study_yr", "current_sem")
    .limit(5)
    .offset(0)
    .from("students_biodata");

  const x = allStudents.map(async (stu) => {
    year = stu.study_yr;
    sem = stu.current_sem;
    const payments = await database
      .select("*")
      .from("student_paid_fess")
      .where({
        stu_no: stu.stdno,
      });

    payments.sort((a, b) => {
      // Sort by 'study_yr' first
      if (a.study_yr < b.study_yr) {
        return -1;
      }
      if (a.study_yr > b.study_yr) {
        return 1;
      }

      // If 'study_yr' is the same, sort by 'sem'
      if (a.sem < b.sem) {
        return -1;
      }
      if (a.sem > b.sem) {
        return 1;
      }

      // If both 'study_yr' and 'sem' are equal, maintain the original order
      return 0;
    });

    if (payments.length > 0) {
      year = payments[payments.length - 1].study_yr;
      sem = payments[payments.length - 1].sem;
    }

    arr.push({ ...stu, year, sem });
  });

  Promise.all(x)
    .then(() => {
      res.send({
        allStudents: arr,
      });
    })
    .catch((err) => {
      res.send({
        error: "Error" + err,
      });
    });
});

router.post("/save_enrolled_modules", async (req, res) => {
  const { stdno, current_sem, study_yr, modules } = req.body;
  // console.log("received this", req.body);
  const existingCategory = await database
    .select("*")
    .from("student_enrollment_categories")
    .where({
      stdno,
      study_yr,
      sem: current_sem,
    });

  if (existingCategory[0]) {
    console.log("already have the modules", stdno);
    return res.send({
      success: true,
      message: "already have the modules",
    });
  }

  const newCategory = await database("student_enrollment_categories").insert({
    stdno,
    study_yr,
    sem: current_sem,
  });

  const fieldsToInsert = modules.map((field, index) => {
    return {
      cat_id: newCategory[0],
      module_code: field.module_code,
      module_title: field.module_title,
      module_level: field.module_level,
      credit_units: field.credit_units,
      module_year: field.module_year,
      module_sem: field.module_sem,
    };
  });

  await database("student_enrolled_modules").insert(fieldsToInsert);
  console.log("new group inserted", stdno);
  res.send({
    success: true,
    message: "modules saved successfully",
  });
});

module.exports = router;
