var express = require('express');
var mysql = require('mysql');
//aws 선언 순서중요함
var aws = require('aws-sdk');
//aws.config.loadFromPath ('./config/AWS_config.json');
var s3= new aws.S3();

var db_config = require('../config/AWS_RDS_Config.json');
const multer= require('multer');
const multerS3= require('multer-s3');
var router = express.Router();

const bodyParser = require('body-parser');
router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());
//이미지테스트
// const fs = require('fs');
// const ejs = require('ejs');

var pool= mysql.createPool({
  host: db_config.host,
  port: db_config.port,
  user: db_config.user,
  password: db_config.password,
  database: db_config.database,
  connectionLimit: db_config.connectionLimit
});

var upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: 'dodghek',
        acl: 'public-read',
        key: function(req, file, cb) {
            cb(null, Date.now() + '.' + file.originalname.split('.').pop());
        }
    })
});
//이미지테스트
// router.get('/test', function(req, res){
//   fs.readFile('views/image_upload.ejs', 'utf-8', function(error, result){
//     if(error)
//       console.log(error);
//     else
//       res.status(200).send(result);
//   });
// });
// router.post('/test/add' , upload.single('pic'),function(req, res, next) {
//   console.log(req.file.location);
// });



//네비게이션
router.get('/', function(req, res) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("poll getConnection Error" + error);
            res.sendStatus(500);
        } else {
             let role = req.query.role;
             let user_id= req.query.user_id;

             let query="";
             if(role=='Client')
                query="select user_name, rating, rated_count, image_path from members a, clients b where a.user_idx=b.user_idx and a.user_id= ? ";
             else if(role=='Helper')
                query="select user_name, rating, rated_count, image_path from members a, helpers b where a.user_idx=b.user_idx and a.user_id= ? ";

              connection.query(query, user_id, function(error, rows) {
                  if (error) {
                      res.sendStatus(500).send({message:"internal server error :"+error});
                      connection.release();
                  } else {
                      if(rows){
                        res.status(200).json({message : "Success in getting navi information", result : rows});
                        connection.release();
                      }else{
                        res.status(400).send({message : "wrong input"});
                        connection.release();
                      }
                  }
              });
        }
    });
});
//네비게이션>용돈조회
router.get('/money', function(req, res) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("poll getConnection Error" + error);
            res.sendStatus(500);
        } else {
              let user_id= req.query.user_id;
              connection.query("select money from members where user_id= ?", user_id, function(error, rows) {
                  if (error) {
                      res.sendStatus(500).send({message:"internal server error :"+error});
                      connection.release();
                  } else {
                      res.status(200).json({message : "Success in getting money of user", result : rows});
                      connection.release();
                  }
              });
        }
    });
});
//네비게이션>마이페이지
router.get('/mypage', function(req, res) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("poll getConnection Error" + error);
            res.sendStatus(500);
        } else {
              let user_id= req.query.user_id;
              connection.query("select image_path from members where user_id= ?", user_id, function(error, rows) {
                  if (error) {
                      res.sendStatus(500).send({message:"internal server error :"+error});
                      connection.release();
                  } else {
                      res.status(200).json({message : "Success in getting photo of user", result : rows});
                      connection.release();
                  }
              });
        }
    });
});
//네비게이션>마이페이지>계정설정-조회
router.get('/mypage/set', function(req, res) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("poll getConnection Error" + error);
            res.sendStatus(500);
        } else {
              let user_id= req.query.user_id;
              connection.query("select user_name, phone, about, image_path from members where user_id= ?", user_id, function(error, rows) {
                  if (error) {
                      res.sendStatus(500).send({message:"internal server error :"+error});
                      connection.release();
                  } else {
                      res.status(200).json({message : "Success in getting user information", result : rows});
                      connection.release();
                  }
              });
        }
    });
});
//네비게이션>마이페이지>계정설정-저장 (이미지 업로드)
router.post('/mypage/set', upload.single('pic'), function(req, res) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("poll getConnection Error" + error);
            res.sendStatus(500);
        } else {
              var value;
              connection.query("update members set user_name=?, phone=?, about=?, image_path=? where user_id= ?", value=[req.body.user_name, req.body.phone, req.body.about, req.file.location, req.body.user_id], function(error, rows) {
                  if (error) {
                      res.sendStatus(500).send({message:"internal server error :"+error});
                      connection.release();
                  } else {

                      res.status(200).json({message : "Success in updating user information"});
                      connection.release();
                  }
              });
        }
    });
});

//네비게이션>마이페이지>장소추가-조회
router.get('/mypage/bookmark', function(req, res) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("poll getConnection Error" + error);
            res.sendStatus(500);
        } else {
              let user_id= req.query.user_id;
              connection.query("select home_name, home_lat, home_long, school_name, school_lat, school_long, company_name, company_lat, company_long, image_path from bookmarks a,members b where a.user_idx=b.user_idx and b.user_id = ?", user_id, function(error, rows) {
                  if (error) {
                      res.sendStatus(500).send({message:"internal server error :"+error});
                      connection.release();
                  } else {
                      res.status(200).json({message : "Success in selecting bookmark", result : rows});
                      connection.release();
                  }
              });
        }
    });
});
//네비게이션>마이페이지>장소추가-수정
router.put('/mypage/bookmark', function(req, res) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("poll getConnection Error" + error);
            res.sendStatus(500);
        } else {
              let user_id= req.query.user_id;
              //일단 bookmarks에는 user_idx가 없기때문에 조회를 한다.
              let idx_query="select user_idx from members where user_id = ?";
              connection.query(idx_query, user_id, function(error, rows){
                if (error) {
                    res.sendStatus(500).send({message:"internal server error :"+error});
                    connection.release();
                }else{
                  let u_id=rows[0].user_idx;
                  //실제 업데이트를 해준다.
                  var value;
                  connection.query("update bookmarks set home_name=?,home_lat=?,home_long=?,school_name=?,school_lat=?,school_long=?,company_name=?,company_lat=?,company_long=? where user_idx = ?",
                  value=[req.query.home_name,req.query.home_lat,req.query.home_long,req.query.school_name,req.query.school_lat,req.query.school_long,req.query.company_name,req.query.company_lat,req.query.company_long,u_id],
                  function(error, rows) {
                      if (error) {
                          res.sendStatus(500).send({message:"internal server error :"+error});
                          connection.release();
                      } else {
                          res.status(200).json({message : "Success in putting bookmark"});
                          connection.release();
                      }
                  });

                }

              });
        }
    });
});
//네비게이션>마이페이지>수행내역
router.get('/mypage/log', function(req, res) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("poll getConnection Error" + error);
            res.sendStatus(500);
        } else {
            let user_id= req.query.user_id;
            //일단 bookmarks에는 user_idx가 없기때문에 조회를 한다.
            let idx_query="select user_idx from members where user_id = ?";
            connection.query(idx_query, user_id, function(error, rows){
              if (error) {
                  res.sendStatus(500).send({message:"internal server error :"+error});
                  connection.release();
              }else{
                let u_id=rows[0].user_idx;

                let role = req.query.role;
                var query="";
                if(role=='Client')
                   query="select matching_time, finish_time, cost, task_type, details from past_tasks where clients_members_idx=?";
                else if(role=='Helper')
                  query="select matching_time, finish_time, cost, task_type, details from past_tasks where helpers_members_idx=?";

                  connection.query(query, u_id, function(error, rows) {
                      if (error) {
                          res.sendStatus(500).send({message:"internal server error :"+error});
                          connection.release();
                      } else {
                          res.status(200).json({message : "Success in getting work logs", result : rows});
                          connection.release();
                      }
                  });
              }
            });

        }
    });
});
//네비게이션>마이페이지>코멘
router.get('/mypage/comments', function(req, res) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("poll getConnection Error" + error);
            res.sendStatus(500);
        } else {
          let user_id= req.query.user_id;
          //일단 bookmarks에는 user_idx가 없기때문에 조회를 한다.
          let idx_query="select user_idx from members where user_id = ?";
          connection.query(idx_query, user_id, function(error, rows){
            if (error) {
                res.sendStatus(500).send({message:"internal server error :"+error});
                connection.release();
            }else{
              let u_id=rows[0].user_idx;
              console.log(u_id);

              let role = req.query.role;
              var query="";
              //id값으로 들어온 녀석의 member의 user_idx를 찾은다음에, 쿼리문에서 user_idx를 삽입해서 찾는다.
              if(role=='Client')
                 query="select user_name, finish_time, rating_h, comment_h from past_tasks a,members b where a.clients_members_idx=b.user_idx and user_idx=?";
              else if(role=='Helper')
                query="select user_name, finish_time, rating_c, comment_c from past_tasks a,members b where a.helpers_members_idx=b.user_idx and user_idx=?";

                connection.query(query, u_id, function(error, rows) {
                    if (error) {
                        res.sendStatus(500).send({message:"internal server error :"+error});
                        connection.release();
                    } else {
                        res.status(200).json({message : "Success in getting comments", result : rows});
                        console.log(rows);
                        connection.release();
                    }
                });
            }
          });

        }
    });
});

module.exports = router;
