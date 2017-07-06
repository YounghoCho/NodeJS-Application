var express = require('express');
var mysql = require('mysql');
var aws = require('aws-sdk');
var db_config = require('../config/AWS_RDS_Config.json');
const bodyParser = require('body-parser');
const multer= require('multer');
const multerS3= require('multer-s3');
var router = express.Router();
var s3= new aws.S3();//S3의 객체를 생성한다

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());

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

//회원가입
router.post('/join', function(req, res) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("poll getConnection Error" + error);
            res.sendStatus(500);
        } else {
          var value=[
            req.body.user_id,
            req.body.user_name,
            req.body.user_pw,
            req.body.phone,
            req.body.image,
            req.body.about];

            let query="insert into members (user_id, user_name, user_pw, phone, image_path, about, join_date) values (?,?,?,?,?,?,now())";
            connection.query(query, value, function(error, rows) {
                  if (error) {
                      res.status(500).send({message:"internal server error :"+error});
                      connection.release();
                  } else {
                      if(rows){
                        //res.status(200).json({message : "Success in joining", rows});
                        //일단 방금 삽입된 user_idx를 호출한다.
                        let query_idx="select user_idx from members where user_id=?";
                        connection.query(query_idx, req.body.user_id, function(error, rows, fields) {
                          if (error) {
                              res.status(500).send({message:"internal server error :"+error});
                              connection.release();
                          } else {
                             //삽입된 계정의 user_idx를 가져오고 (중요)
                              let u_idx = rows[0].user_idx;
                              //clients helpers에도 데이터를 넣어줘야한다.
                              let query_clients="insert into clients (user_idx) values (?)";
                              connection.query(query_clients, u_idx, function(error, rows) {
                                if (error) {
                                    res.status(500).send({message:"internal server error :"+error});
                                    connection.release();
                                }
                              });
                              let query_helpers="insert into helpers (user_idx) values (?)";
                              connection.query(query_helpers, u_idx, function(error, rows) {
                                if (error) {
                                    res.status(500).send({message:"internal server error :"+error});
                                    connection.release();
                                }
                              });
                              let query_bookmarks="insert into bookmarks (user_idx) values (?)";
                              connection.query(query_bookmarks, u_idx, function(error, rows) {
                                if (error) {
                                    res.status(500).send({message:"internal server error :"+error});
                                    connection.release();
                                }
                              });
                             //성공
                             res.status(200).send({message:"success in joining"});
                             connection.release();
                          }
                        });

                      }else{
                        res.status(400).send({message : "wrong input"});
                        connection.release();
                      }
                  }
              });
        }
    });
});
//중복확인
router.get('/join/check', function(req,res){
  pool.getConnection(function(error, connection) {
    if(error){
      console.log("poll getConnection Error" + error);
      res.sendStatus(500);
    }else{
      let value=req.query.user_id;
      let query="select user_idx from members where user_id= ? ";
      connection.query(query, value, function(error, rows) {
          if (error) {
              res.status(500).send({message:"internal server error :"+error});
              connection.release();
          } else {
            //없을때 설정하는 규격은 아래와 같다 (중요)
              if(rows[0]==undefined){
                res.status(400).send({message : "there is no id"});
                connection.release();
              }
              else{
                res.status(200).json({message : "id already exists"});
                connection.release();
              }
          }
      });
    }
  });
});
//로그인
router.post('/login', function(req, res) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("poll getConnection Error" + error);
            res.sendStatus(500);
        } else {
            if(req.body.user_pw==undefined){
              //android login
              var value2=req.body.user_id;
              let query="select user_idx from members where user_id = ?";
               connection.query(query, value2, function(error, rows2) {
                   if (error) {
                      console.log(error);
                       res.status(500).send({message:"internal server error :"+error});
                       connection.release();
                   } else {
                     //등록된 id가 없으면 삽입
                      if(rows2[0]==undefined){
                        let value3=[req.body.user_id, req.body.user_name, req.body.phone];
                        let query2="insert into members (user_idx, user_id, user_name, phone) values ('', ?,?,?)";
                        connection.query(query2, value3, function(error, rows3) {
                          if (error) {
                              console.log(error);
                              res.status(500).send({message:"internal server error :"+error});
                              connection.release();
                          } else {
                            //members, helpers, bookmarks에도 정보 등록.
                              //일단 방금 삽입된 user_idx를 호출한다.
                              let query_idx="select user_idx from members where user_id=?";
                              connection.query(query_idx, req.body.user_id, function(error, rows, fields) {
                                if (error) {
                                    res.status(500).send({message:"internal server error :"+error});
                                    connection.release();
                                } else {
                                   //삽입된 계정의 user_idx를 가져오고 (중요)
                                    let u_idx = rows[0].user_idx;
                                    //clients helpers에도 데이터를 넣어줘야한다.
                                    let query_clients="insert into clients (user_idx) values (?)";
                                    connection.query(query_clients, u_idx, function(error, rows) {
                                      if (error) {
                                          res.status(500).send({message:"internal server error :"+error});
                                          connection.release();
                                      }
                                    });
                                    let query_helpers="insert into helpers (user_idx) values (?)";
                                    connection.query(query_helpers, u_idx, function(error, rows) {
                                      if (error) {
                                          res.status(500).send({message:"internal server error :"+error});
                                          connection.release();
                                      }
                                    });
                                    let query_bookmarks="insert into bookmarks (user_idx) values (?)";
                                    connection.query(query_bookmarks, u_idx, function(error, rows) {
                                      if (error) {
                                          res.status(500).send({message:"internal server error :"+error});
                                          connection.release();
                                      }
                                    });
                                   //성공
                                   res.status(200).send({message:"success in login"});
                                   connection.release();
                                }
                              });
                          }
                        });
                      }else{
                      //등록된 아이디가 이미 있으면 있다고해
                      res.sendStatus(200);
                      connection.release();
                      }
                   }
               });
            }else{
              //ios login
               var value=[
                 req.body.user_id,
                 req.body.user_pw
               ];
               let query="select user_idx from members where user_id = ? and user_pw = ?";
                connection.query(query, value, function(error, rows) {
                    if (error) {
                        res.status(500).send({message:"internal server error :"+error});
                        connection.release();
                    } else {
                        if(rows){
                          res.status(200).json({message : "Success in login"});
                          connection.release();
                        }else{
                          res.status(400).send({message : "wrong input"});
                          connection.release();
                        }
                    }
                });
            }

        }
    });
});
module.exports = router;
