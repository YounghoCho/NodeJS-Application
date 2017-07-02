var express = require('express');
var mysql = require('mysql');
var aws = require('aws-sdk');
var db_config = require('../config/db_config.json');
aws.config.loadFromPath('./config/aws_config.json');
var multer = require('multer');
var multerS3 = require('multer-s3');
var router = express.Router();
var s3 = new aws.S3();
var brand_table = ['Innisfree', 'Nature', 'TheSaem', 'TheFaceshop', 'Missha', 'VDL', 'SkinFood', 'Aritaum', 'Apieu', 'Etude', 'Espoir', 'Olive', 'ItsSkin', 'Tonymoly', 'Holika'];
var url_table=['http://m.innisfree.co.kr/MainShopping.do',
              'http://www.naturerepublic.com/shop/main',
              'http://www.thesaemcosmetic.com/page/shopping',
              'http://www.thefaceshop.com/mall/index.jsp',
              'http://missha.beautynet.co.kr/main.do',
              'http://www.vdlcosmetics.com/index.jsp',
              'http://www.theskinfood.com/shopMain/shopMain.do',
              'http://www.aritaum.com/main.do',
              'http://apieu.beautynet.co.kr/main.do',
              'http://www.etude.co.kr/main.do?method=main',
              'http://www.espoir.com/main.do',
              'http://www.oliveyoungshop.com',
              'http://www.itsskin.co.kr',
               'http://www.etonymoly.com/',
               'http://www.holikaholika.co.kr/FrontStore/iStartPage.phtml'];

var upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: 'sopt-hj',
        acl: 'public-read',
        key: function(req, file, cb) {
            cb(null, Date.now() + '.' + file.originalname.split('.').pop());
        }
    })
});

var pool = mysql.createPool({
    host: db_config.host,
    port: db_config.port,
    user: db_config.user,
    password: db_config.password,
    database: db_config.database,
    connectionLimit: db_config.connectionLimit
});

router.post('/add', upload.single('wish_image'),function(req, res, next) {
    console.log(req.body);


    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.sendStatus(500);
        } else {
            var sql, value;
            console.log(req.body.user_id);
            console.log(req.body.pro_id);

            if (req.file) {


                var url=url_table[req.body.brand_id];

                sql = 'insert into WishList(user_id, brand_id, pro_id, wish_title, wish_price, wish_image, wish_memo, pro_url) values(?,?,-1,?,?,?,?,?)';
                value = [req.body.user_id, req.body.brand_id, req.body.wish_title, req.body.wish_price, req.file.location, req.body.wish_memo, url];
                connection.query(sql, value, function(error, rows) {
                    if (error) {
                        console.log("Connection Error" + error);
                        res.sendStatus(500);
                        connection.release();
                    } else {
                        console.log("add WishList");
                        var sql2 = 'SELECT wish_id FROM WishList WHERE user_id = ? ORDER BY wish_id DESC LIMIT 1';
                        connection.query(sql2, [req.body.user_id], function (error2, rows2) {
                          if(error2){
                            console.log("Connection Error" + error);
                            res.sendStatus(500);
                            connection.release();
                          }else {


                             //   console.log("test2"+rows2[0].wish_id);
                            var sql3='select * from WishList where wish_id = ?';
                            connection.query(sql3,[rows2[0].wish_id],function(error3, rows3){
                                if(error3){
                                    console.log("Connection Error" + error);
                                    res.sendStatus(500);
                                    connection.release();

                               }else{
                                    console.log(rows3[0]);
                                    res.status(200).send(rows3[0]);
                                    connection.release();
                                }
                            });
                          }
                        });
                    }
                });
            } else {
              var url=url_table[req.body.brand_id];
                var table = brand_table[req.body.brand_id];
                var query = 'select * from ' + table + ' where pro_id = ?'

                connection.query(query, [req.body.pro_id], function(error1, rows1) {
                    if (error1) {
                        console.log("Connection Error" + error1);
                        res.sendStatus(500);
                        connection.release();
                    } else {
                        var data = rows1[0];
                        var iQuery = 'insert into WishList(user_id, brand_id, pro_id, wish_title, wish_price, wish_image, wish_memo, pro_url ) values(?,?,?,?,?,?,?,?)';
                        var iValue = [req.body.user_id, req.body.brand_id, req.body.pro_id, data.pro_name, data.pro_price, data.pro_image, req.body.wish_memo, data.pro_url];
                        connection.query(iQuery, iValue, function(error2, rows2) {
                            if (error2) {
                                console.log("Connection Error" + error2);
                                res.sendStatus(500);
                                connection.release();
                            } else {
                                console.log("add WishList");
                                var sql2 = 'SELECT wish_id FROM WishList WHERE user_id = ? ORDER BY wish_id DESC LIMIT 1';
                                connection.query(sql2, [req.body.user_id], function (error2, rows2) {
                                  if(error2){
                                    console.log("Connection Error" + error);
                                    res.sendStatus(500);
                                    connection.release();
                                  }else {
                                 //   console.log("test2"+rows2[0].wish_id);
                                    var sql3='select * from WishList where wish_id = ?';
                                    connection.query(sql3,[rows2[0].wish_id],function(error3, rows3){
                                        if(error3){
                                            console.log("Connection Error" + error);
                                            res.sendStatus(500);
                                            connection.release();

                                        }else{
                                            //console.log(rows3[0].brand_id);
                                            res.status(200).send(rows3[0]);
                                            connection.release();
                                        }
                                    });

                                  }
                                });
                            }
                        });
                    }
                });
            }
        }
    });
});

router.post('/ios/add', upload.single('wish_image'),function(req, res, next) {
    console.log(req.body);
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.sendStatus(500);
        } else {
            var sql, value;
              var datas = JSON.parse(req.body.object);
              var data = datas[0];
              console.log(data);
            console.log(data.user_id);
            console.log(data.pro_id);

            if (req.file) {

                var url=url_table[data.brand_id];
                sql = 'insert into WishList(user_id, brand_id, pro_id, wish_title, wish_price, wish_image, wish_memo, pro_url) values(?,?,-1,?,?,?,?,?)';
                value = [data.user_id, data.brand_id, data.wish_title, data.wish_price, req.file.location, data.wish_memo, url];
                connection.query(sql, value, function(error, rows) {
                    if (error) {
                        console.log("Connection Error" + error);
                        res.sendStatus(500);
                        connection.release();
                    } else {
                        console.log("add WishList");
                        var sql2 = 'SELECT wish_id FROM WishList WHERE user_id = ? ORDER BY wish_id DESC LIMIT 1';
                        connection.query(sql2, [data.user_id], function (error2, rows2) {
                          if(error2){
                            console.log("Connection Error" + error);
                            res.sendStatus(500);
                            connection.release();
                          }else {


                             //   console.log("test2"+rows2[0].wish_id);
                            var sql3='select * from WishList where wish_id = ?';
                            connection.query(sql3,[rows2[0].wish_id],function(error3, rows3){
                                if(error3){
                                    console.log("Connection Error" + error);
                                    res.sendStatus(500);
                                    connection.release();

                               }else{
                                    console.log(rows3[0]);
                                    res.status(200).send({'result':rows3[0]});
                                    connection.release();
                                }
                            });
                          }
                        });
                    }
                });
            } else {
                var table = brand_table[req.body.brand_id];
                var query = 'select * from ' + table + ' where pro_id = ?'

                connection.query(query, [req.body.pro_id], function(error1, rows1) {
                    if (error1) {
                        console.log("Connection Error" + error1);
                        res.sendStatus(500);
                        connection.release();
                    } else {
                        var data = rows1[0];
                        var iQuery = 'insert into WishList(user_id, brand_id, pro_id, wish_title, wish_price, wish_image, wish_memo, pro_url) values(?,?,?,?,?,?,?,?)';
                        var iValue = [req.body.user_id, req.body.brand_id, req.body.pro_id, data.pro_name, data.pro_price, data.pro_image, req.body.wish_memo, data.pro_url];
                        connection.query(iQuery, iValue, function(error2, rows2) {
                            if (error2) {
                                console.log("Connection Error" + error2);
                                res.sendStatus(500);
                                connection.release();
                            } else {
                                console.log("add WishList");
                                var sql2 = 'SELECT wish_id FROM WishList WHERE user_id = ? ORDER BY wish_id DESC LIMIT 1';
                                connection.query(sql2, [req.body.user_id], function (error2, rows2) {
                                  if(error2){
                                    console.log("Connection Error" + error);
                                    res.sendStatus(500);
                                    connection.release();
                                  }else {
                                 //   console.log("test2"+rows2[0].wish_id);
                                    var sql3='select * from WishList where wish_id = ?';
                                    connection.query(sql3,[rows2[0].wish_id],function(error3, rows3){
                                        if(error3){
                                            console.log("Connection Error" + error);
                                            res.sendStatus(500);
                                            connection.release();

                                        }else{
                                            //console.log(rows3[0].brand_id);
                                            res.status(200).send({'result':rows3[0]});
                                            connection.release();
                                        }
                                    });

                                  }
                                });
                            }
                        });
                    }
                });
            }
        }
    });
});


router.get('/load/:user_id', function(req, res, next) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.sendStatus(500);
        } else {
          var totalValue = [req.params.user_id];
          var totalQuery = 'SELECT sum(wish_price) as  total FROM WishList where user_id = ? group by user_id;'
          var countValue = [req.params.user_id];
          var countQuery = 'SELECT count(*) as count FROM WishList where user_id = ?;'
          var load;
          var total;
          var count;
          var value = [req.params.user_id];
          connection.query('select distinct brand_id from WishList where user_id = ?', value, function(error, rows) {
              if (error) {
                  console.log("Connection Error" + error);
                  res.sendStatus(500);
                  connection.release();
              } else {
                  console.log('Load WishList(Specific Data)');
                  load = rows;
                  connection.query(totalQuery, totalValue, function(error2, rows2) {
                      if (error2) {
                          console.log("Connection Error" + error2);
                          res.sendStatus(500);
                          connection.release();
                      } else {
                          console.log('Load WishList(Specific Data)');
                          if(rows2[0] == undefined || rows2[0] == null){
                            total = 0;
                          } else {
                              total = rows2[0];
                          }
                          connection.query(countQuery, countValue, function(error3, rows3) {
                              if (error3) {
                                  console.log("Connection Error" + error3);
                                  res.sendStatus(500);
                                  connection.release();
                              } else {
                                  console.log('Load WishList(Specific Data)');
                                  if(rows3[0] == undefined || rows3[0] == null){
                                    count = 0;
                                  } else {
                                      count = rows3[0];
                                  }
                                  res.status(200).send({'brand': load, 'total': total.total, 'count':count.count});
                                  connection.release();
                              }
                          });
                      }
                  });
              }
          });
        }
    });
});

//사용자의 전체 위시리스트 불러오기
router.get('/all/:user_id', function(req, res, next) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.sendStatus(500);
        } else {
          //  var brand_id = 0;
            var value = [req.params.user_id];
            connection.query('select * from WishList where user_id = ?;', value, function(error, rows) {
                if (error) {
                    console.log("Connection Error" + error);
                    res.sendStatus(500);
                    connection.release();
                } else {
                    console.log('Load All WishList');
                    res.status(200).send(rows);
                    connection.release();
                }
            });
        }
    });
});


//사용자 위시리스트의 총 갯수 불러오기
router.get('/count/:user_id', function(req, res, next) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.sendStatus(500);
        } else {
            var value = [req.params.user_id];
            var query = 'SELECT count(*) as count FROM WishList where user_id = ?;'
            connection.query(query, value, function(error, rows) {
                if (error) {
                    console.log("Connection Error" + error);
                    res.sendStatus(500);
                    connection.release();
                } else {
                    console.log('WishList Count');
                    res.status(200).send(rows[0]);
                    connection.release();
                }
            });
        }
    });
});

//사용자 위시리스트의 총합 불러오기
router.get('/totalPrice/:user_id', function(req, res, next) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.sendStatus(500);
        } else {
            var value = [req.params.user_id];
            var query = 'SELECT sum(wish_price) as  total FROM WishList where user_id = ? group by user_id;;'
            connection.query(query, value, function(error, rows) {
                if (error) {
                    console.log("Connection Error" + error);
                    res.sendStatus(500);
                    connection.release();
                } else {
                    console.log('Load WishList(Only BrandName)');
                    res.status(200).send(rows[0]);
                    connection.release();
                }
            });
        }
    });
});


router.get('/load2/:user_id/:brand_id', function(req, res, next) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.sendStatus(500);
        } else {
            var value = [req.params.user_id, req.params.brand_id];
            connection.query('select * from WishList where user_id = ? and brand_id = ?', value, function(error, rows) {
                if (error) {
                    console.log("Connection Error" + error);
                    res.sendStatus(500);
                    connection.release();
                } else {
                    console.log('Load WishList(Specific Data)');
                    res.status(200).send(rows);
                    connection.release();
                }
            });
        }
    });
});

router.get('/search/:pro_name/:brand_id', function(req, res, next) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.sendStatus(500);
        } else {
            console.log(req.params.pro_name);
            var table = brand_table[req.params.brand_id];
            console.log(table);
            var value = [req.params.pro_name];
            var query = 'select * from ' + table + ' where pro_name like "%"?"%"'
            connection.query(query, value, function(error, rows) {
                if (error) {
                    console.log("Connection Error" + error);
                    res.sendStatus(500);
                    connection.release();
                } else {
                    console.log('Search Product');
                    res.status(200).send(rows);
                    connection.release();
                }
            });
        }
    });
});

router.post('/ios/search', function(req, res, next) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.sendStatus(500);
        } else {
            console.log(req.body.pro_name);
            var table = brand_table[req.body.brand_id];
            console.log(table);
            var value = [req.body.pro_name];
            var query = 'select * from ' + table + ' where pro_name like "%"?"%"'
            connection.query(query, value, function(error, rows) {
                if (error) {
                    console.log("Connection Error" + error);
                    res.sendStatus(500);
                    connection.release();
                } else {
                    console.log('Search Product');
                    res.status(200).send(rows);
                    connection.release();
                }
            });
        }
    });
});

router.get('/delete/:wish_id', function(req, res, next) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.sendStatus(500);
        } else {
            var value = [req.params.wish_id];
            connection.query('delete from WishList where wish_id = ?', value, function(error, rows) {
                if (error) {
                    console.log("Connection Error" + error);
                    res.sendStatus(500);
                    connection.release();
                } else {
                    console.log('delete Product in WishList');
                    res.sendStatus(200);
                    connection.release();
                }
            });
        }
    });
});

router.post('/modify',  upload.single('wish_image'), function(req, res, next) {
      pool.getConnection(function(error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.sendStatus(500);
        } else {
            var sql, value;

            if (req.file) {
                sql = 'update WishList set wish_title = ?, wish_price = ?, wish_image = ?, wish_memo  = ? where wish_id =?';
                value = [req.body.wish_title, req.body.wish_price, req.file.location, req.body.wish_memo, req.body.wish_id];
            } else {
              if(req.body.wish_title == undefined || req.body.wish_title == null){
                sql = 'update WishList set wish_memo  = ? where wish_id = ?';
                value = [req.body.wish_memo, req.body.wish_id];
              } else {
                sql = 'update WishList set wish_title = ?, wish_price = ?,  wish_memo  = ? where wish_id =?';
                value = [req.body.wish_title, req.body.wish_price, req.body.wish_memo, req.body.wish_id];
              }
            }
            connection.query(sql, value, function(error, rows) {
                if (error) {
                    console.log("Connection Error" + error);
                    res.sendStatus(500);
                    connection.release();
                } else {
                    console.log("modify WishList");
                    res.sendStatus(200);
                    connection.release();
                }
            });
        }
    });
});

/////

router.get('/specific/:wish_id', function(req, res, next) {
    pool.getConnection(function(error, connection){
        if (error){
            console.log("getConnection Error" + error);
            res.sendStatus(500);
        }
        else{
            var query = 'SELECT * FROM WishList where wish_id = ?;'
            var value=[req.params.wish_id];

            connection.query(query, value , function(error, rows){
                if (error){
                    console.log("Connection Error" + error);
                    res.sendStatus(500);
                    connection.release();
                }
                else {
                    console.log('Specific WishList');
                    res.status(200).send(rows[0]);
                    connection.release();
                }
            });
        }
    });
});


module.exports = router;
