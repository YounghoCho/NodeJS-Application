var express = require('express');
var mysql = require('mysql');
var aws = require('aws-sdk');
var db_config = require('../config/AWS_RDS_Config.json');
aws.config.loadFromPath('./config/AWS_config.json');//.한개지 ..두개찍으면 안됨.
const multer= require('multer');
const multerS3= require('multer-s3');
var router = express.Router();
var s3= new aws.S3();//S3의 객체를 생성한다

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

//네비게이션
router.get('/', function(req, res) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("poll getConnection Error" + error);
            res.sendStatus(500);
        } else {
             let role = req.query.role;
             var query="";
             if(role=='"Client"')
                query="select user_name, rating, rated_count from members a, clients b where a.user_idx=1";
             else if(role=='"Helper"')
                query="select user_name, rating, rated_count from members a, helpers b where a.user_idx=1";

              connection.query(query, role, function(error, rows) {
                  if (error) {
                      res.sendStatus(500).send({message:"internal server error :"+error, result:""});
                      connection.release();
                  } else {
                      res.status(200).json({message : "Success in getting information that depends on role", result : rows});
                      connection.release();
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
              connection.query("select money from members", function(error, rows) {
                  if (error) {
                      res.sendStatus(500).send({message:"internal server error :"+error, result:""});
                      connection.release();
                  } else {
                      res.status(200).json({message : "Success in getting photo of user", result : rows});
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
              connection.query("select image_path from members", function(error, rows) {
                  if (error) {
                      res.sendStatus(500).send({message:"internal server error :"+error, result:""});
                      connection.release();
                  } else {
                      res.status(200).json({message : "Success in getting user information", result : rows});
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
              connection.query("select user_name, phone, about from members", function(error, rows) {
                  if (error) {
                      res.sendStatus(500).send({message:"internal server error :"+error, result:""});
                      connection.release();
                  } else {
                      res.status(200).json({message : "Success in getting user information", result : rows});
                      connection.release();
                  }
              });
        }
    });
});
//네비게이션>마이페이지>계정설정-저장
router.put('/mypage/set/:user_idx', function(req, res) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("poll getConnection Error" + error);
            res.sendStatus(500);
        } else {
              var value;
              connection.query("update members set user_name=?, phone=?, about=? where user_idx=?", value=[req.query.user_name, req.query.phone, req.query.about, req.params.user_idx], function(error, rows) {
                  if (error) {
                      res.sendStatus(500).send({message:"internal server error :"+error, result:""});
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
              connection.query("select home_name, home_lat, home_long, school_name, school_lat, school_long, company_name, company_lat, company_long from bookmarks", function(error, rows) {
                  if (error) {
                      res.sendStatus(500).send({message:"internal server error :"+error, result:""});
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
              var value;
              connection.query("update bookmarks set home_name=?,home_lat=?,home_long=?,school_name=?,school_lat=?,school_long=?,company_name=?,company_lat=?,company_long=?",
              value=[req.query.home_name,req.query.home_lat,req.query.home_long,req.query.school_name,req.query.school_lat,req.query.school_long,req.query.company_name,req.query.company_lat,req.query.company_long],
              function(error, rows) {
                  if (error) {
                      res.sendStatus(500).send({message:"internal server error :"+error, result:""});
                      connection.release();
                  } else {
                      res.status(200).json({message : "Success in putting bookmark"});
                      connection.release();
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
            let role = req.query.role;
            var query="";
            if(role=='"Client"')
               query="select finish_time, matching_time, finish_time, cost, task_type from past_tasks where helpers_members_id='1'";
            else if(role=='"Helper"')
              query="select finish_time, matching_time, finish_time, cost, task_type from past_tasks where clients_members_id='1'";

              connection.query(query, function(error, rows) {
                  if (error) {
                      res.sendStatus(500).send({message:"internal server error :"+error, result:""});
                      connection.release();
                  } else {
                      res.status(200).json({message : "Success in getting work logs", result : rows});
                      connection.release();
                  }
              });
        }
    });
});
//네비게이션>마이페이지>수행내역>상세내역
router.get('/mypage/log/detail', function(req, res) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("poll getConnection Error" + error);
            res.sendStatus(500);
        } else {
            let role = req.query.role;
            var query="";
            if(role=='"Client"')
               query="select finish_time, matching_time, finish_time, cost, task_type, details from past_tasks where helpers_members_id='1'";
            else if(role=='"Helper"')
              query="select finish_time, matching_time, finish_time, cost, task_type, details from past_tasks where clients_members_id='1'";

              connection.query(query, function(error, rows) {
                  if (error) {
                      res.sendStatus(500).send({message:"internal server error :"+error, result:""});
                      connection.release();
                  } else {
                      res.status(200).json({message : "Success in getting work logs", result : rows});
                      connection.release();
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
            let role = req.query.role;
            var query="";
            //id값으로 들어온 녀석의 member의 user_idx를 찾은다음에, 쿼리문에서 user_idx를 삽입해서 찾는다.
            if(role=='"Client"')
               query="select user_name, finish_time, rating_h, comment_h from past_tasks a,members b where a.helpers_members_idx='1'";
            else if(role=='"Helper"')
              query="select user_name, finish_time, rating_c, comment_c from past_tasks a,members b where a.clients_members_idx='1'";

              connection.query(query, function(error, rows) {
                  if (error) {
                      res.sendStatus(500).send({message:"internal server error :"+error, result:""});
                      connection.release();
                  } else {
                      res.status(200).json({message : "Success in getting comments", result : rows});
                      connection.release();
                  }
              });
        }
    });
});

module.exports = router;
