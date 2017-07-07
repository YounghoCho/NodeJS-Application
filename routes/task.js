var express = require('express');
var mysql = require('mysql');
var aws = require('aws-sdk');
var db_config = require('../config/AWS_RDS_Config.json');
const bodyParser = require('body-parser');
const multer = require('multer');
const multerS3 = require('multer-s3');
var router = express.Router();
var s3 = new aws.S3();//S3의 객체를 생성한다
var date_utils = require('date-utils');
//var schedule = require('node-schedule');
var gcm=require('node-gcm');

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.text());

//gcm
var server_api_key='AAAABUVEzU4:APA91bESHNJ_qKxVOeIcaT5k6H9puphSEIYgemOBE6jo20LOmjbSYwdowP0qJduHaReO0k4b1wYeHf4R_n3eNKXgdWbZQhRrdccMXT2jqN05K1TCf5QoChSpwF0RO9jnI7yV1YJNFFb-';
var sender=new gcm.Sender(server_api_key);
var registrationIds=[];

var pool = mysql.createPool({
    host: db_config.host,
    port: db_config.port,
    user: db_config.user,
    password: db_config.password,
    database: db_config.database,
    connectionLimit: db_config.connectionLimit
});

//코멘트 추가해야함!
//수행자입장에서 검색
router.get('/helper', function (req, res) {
    pool.getConnection(function (error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.status(500).send({ message: 'internal server error'});
        } else {
            let user_id = req.query.user_id;
            let selectQuery = 'SELECT h.status FROM helpers h, members m WHERE m.user_id = ? AND h.user_idx = m.user_idx';
            connection.query(selectQuery, user_id, function (err, rows) {
                if (err) {
                    console.log("Connection Error1 : " + err);
                    res.status(500).send({ message: 'internal server error'});
                    connection.release();
                } else {
                    //이 사용자가 이미 수행중인지 체크
                    //수정****
                    console.log("status : "+rows[0].status);
                    if (rows[0].status == "D") {
                        console.log("this helper already help other client");
                        res.status(405).send({ message: 'this helper already helps'});
                        connection.release();
                    } else {
                        //수행중이지 않으면
                        //올바른 좌표 들어오는지 체크
                        let home_lat = req.query.home_lat; let home_long = req.query.home_long;
                        let workplace_lat = req.query.workplace_lat; let workplace_long = req.query.workplace_long;
                        console.log(req.query.home_lat); console.log(req.query.home_long);
                        console.log(req.query.workplace_lat); console.log(req.query.workplace_long);

                        if (!(home_lat && home_long && workplace_lat && workplace_long && user_id)) {
                            res.status(400).send({ message: 'wrong inout'});
                            connection.release();
                        } else {
                            let lat = (parseFloat(home_lat) + parseFloat(workplace_lat)) / parseFloat(2.0);
                            let long = (parseFloat(home_long) + parseFloat(workplace_long)) / parseFloat(2.0);

                            //소수점 6 이하 자르기
                            Math.floor(lat * 1000000) / 1000000;
                            Math.floor(long * 1000000) / 1000000;

                            function getDistance(lat1, lng1, lat2, lng2) {
                                function deg2rad(deg) {
                                    return deg * (Math.PI / 180);
                                }
                                var dLat = deg2rad(lat2 - lat1);  // deg2rad below
                                var dLon = deg2rad(lng2 - lng1);
                                var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                                var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                var d = 6371 * c; // Distance in km
                                return d * 0.55;
                            }
                            var r = getDistance(workplace_lat, workplace_long, home_lat, home_long);

                            console.log("center : ", lat, long);
                            console.log("radius : ", r);
                            //let selectQuery = 'SELECT t.*, m.user_name, m.phone, (c.rating/c.rated_count) AS star, m.image_path FROM current_tasks t, clients c, members m WHERE matching_time = ? AND (6371*acos(cos(radians(?))*cos(radians(workplace_lat))*cos(radians(workplace_long)-radians(?))+sin(radians(?))*sin(radians(workplace_lat))))<=? AND t.clinets_members_idx = m.user_idx AND m.user_idx = c.user_idx GROUP BY m.user_idx;';
                            //요주의 쿼리***********
                            let selectQuery = 'SELECT t.*, m.phone, (c.rating/c.rated_count) as star, m.image_path, m.user_name FROM current_tasks t, clients c, members m WHERE t.clients_members_idx=c.user_idx AND c.user_idx=m.user_idx AND matching_time = ? AND (6371*acos(cos(radians(?))*cos(radians(home_lat))*cos(radians(home_long)-radians(?))+sin(radians(?))*sin(radians(home_lat))))<=? group by m.user_idx';
                            //let selectQuery = 'SELECT * FROM current_tasks WHERE matching_time = ? AND (6371*acos(cos(radians(?))*cos(radians(workplace_lat))*cos(radians(workplace_long)-radians(?))+sin(radians(?))*sin(radians(workplace_lat))))<=?';
                            var value = ["0000-00-00 00:00:00", lat, long, lat, r];
                            connection.query(selectQuery, value, function (error2, rows2) {
                                if (error) {
                                    console.log("Connection Error2 : " + error2);
                                    res.status(500).send({ message: 'internal server error'});
                                    connection.release();
                                } else {
                                    console.log("Success in selecting the task list");
                                    res.status(200).send({ message: "Success in selecting the task list", result: rows2 });
                                    connection.release();
                                }
                            });
                        }
                    }
                }
            });
        }
    });
});

//의뢰자
//30분 타이머!!!
//의뢰인 상태 돈 충분한지 체크
//current에 등록
//result에 task_idx넘겨줘야함
router.put('/client', function (req, res) {
    pool.getConnection(function (error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.status(500).send({ message: "getConnection Error" + error });
            connection.release();
        } else {
          console.log("workplace_name ok?: "+req.query.workplace_name);
            let task_type = req.query.task_type;             let cost = req.query.cost;
            let details = req.query.details;                 let deadline = req.query.deadline;
            let workplace_lat = req.query.workplace_lat;     let workplace_long = req.query.workplace_long;
            let home_lat = req.query.home_lat;               let home_long = req.query.home_long;
            let workplace_name = req.query.workplace_name;   let home_name = req.query.home_name;
            var user_id = req.query.user_id;                 //let user_idx;
			
			console.log(task_type+" "+cost+" "+details+" "+deadline+" "+workplace_lat+" "+workplace_long+" "+home_lat+" "+home_long+" "+workplace_name+" "+home_name+" "+user_id);

            //올바른 인풋이 아닐때
            if (!(task_type && cost && details && deadline && workplace_lat && workplace_long
                && home_lat && home_long && workplace_name && home_name && user_id)) {
				console.log('wrong input');
                res.status(400).send({ message: 'wrong input' });
                connection.release();
            } else {
                //의뢰 가능한 사람인지 검증
                let selectQuery = 'SELECT c.status, m.money, m.user_idx FROM clients c, members m WHERE m.user_idx = c.user_idx AND m.user_id = ?;';
                connection.query(selectQuery, user_id, function (err, rows) {
                    if (err) {
                        console.log("Connection Error1 : " + err);
                        res.status(500).send({ message: "Connection Error1 : " + err });
                        connection.release();
                    } else {
						console.log("why error?");
						console.log("rows: "+rows);
						console.log("rows[0]: "+rows[0]);

                        if (rows[0].status == "D") {
                            //이미 의뢰중인 사람이면
                            console.log("this user is already asking");
                            res.status(405).send({ message: 'this user is already asking' });
                            connection.release();
                        } else if(rows[0].money < cost) {
                            //돈없는 사람이면
                            console.log("can not ask because of money");
                            res.status(405).send({ message: 'can not ask because of money' });
                            connection.release();
                        } else if (rows[0].user_idx){
                            //의뢰가능한 사람이면 테이블에 정보 삽입
                            user_idx = rows[0].user_idx;
                            console.log("This man can ask a work: ");
                            let insertQuery = 'INSERT INTO current_tasks (clients_members_idx, helpers_members_idx, task_type, cost, details, home_lat, home_long, workplace_lat, workplace_long, workplace_name, home_name, deadline) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)';
                                                                        let value = [user_idx, '', task_type, cost, details, home_lat, home_long, workplace_lat, workplace_long, workplace_name, home_name, deadline];
                            connection.query(insertQuery, value, function (err2, rows2) {
                                if (err2) {
                                    console.log("Connection Error2 : " + err2);
                                    res.status(500).send("Connection Error2 : " + err2);
                                    connection.release();
                                } else {
                                    //사용자 상태변경
                                    console.log(user_idx);
                                      let insertQuery="update clients set status = 'D' where user_idx= ?";
                                      connection.query(insertQuery, user_idx, function (err3, rows3) {
                                        if (err2) {
                                            console.log("Connection Error3 : " + err3);
                                            res.status(500).send("Connection Error3 : " + err3);
                                            connection.release();
                                          }else{
                                            res.status(200).json({ message: "Success in asking"});
                                            connection.release();
                                          }
                                      });
									  // 30분 후 정보삭제
											setTimeout(function(){
                                              console.log("work0");
                                                //----1----//
                                               let query1="SELECT matching_time from current_tasks where clients_members_idx= ?";
                                               connection.query(query1, user_idx, function(err1,rows1){
                                                 if(err1){
                                                   console.log("err1: "+err1);
                                                   connection.release();
                                                 }
                                                 else{
                                                   if(rows1[0].matching_time=='0000-00-00 00:00:00'){
                                                     console.log('work1');
                                                     //----2----//
                                                     let query2="DELETE from current_tasks where clients_members_idx= ?";
                                                     connection.query(query2, user_idx, function(err2,rows2){
                                                       console.log('work2');
                                                       if(err2){
                                                         console.log("err2: "+err2);
                                                         connection.release();
                                                       }else{
                                                         //----3----//
                                                         let query3="UPDATE clients set status = 'A' where user_idx= ?";
                                                         connection.query(query3, user_idx, function(err3,rows3){
                                                            console.log('work3');
                                                           if(err3){
                                                             console.log("err3: "+err3);
                                                             connection.release();
                                                           }
                                                         });
                                                       }
                                                     });

                                                   }
                                                 }

                                               });
                                             },1800000);

                                }
                            });
                        }
                    }
                });
            }
        }
    });
});

//유저 아이디로 유저 idx 검색해서 저장 / 유저 상태도 변경
//요청이 오면 current에서 별점으로 검색 : post past + finish time = 0000-00-00 00:00:00 star이랑 id 등록
//두번 쨰 요청이 오면 put past matching time star이랑 id 등록 / delete current - 검사
//ㅇㅖ외처리 해야함!
//finishtime default 값
router.get('/star', function (req, res) {
    pool.getConnection(function (error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.status(500).send("getConnection Error" + error);
            connection.release();
        } else {
            var user_id = req.query.user_id; var user_star = req.query.user_star;
            var user_comment = req.query.user_comment; var role = req.query.role;
            console.log(user_id, user_star, user_comment, role);

            let user_idx; let user_idx2; let cost;
            let insertQuery; let selectQuery; let deleteQuery; let updateQuery; let selectQuery2;

            //제대로 값이 들어왔는지 확인
            if (!(user_id && user_star && user_comment && role)) {
                res.status(405).send({ message: 'wrong input - body' });
                connection.release();
            } else {
                //사용자 user_idx 구함
                selectQuery = "SELECT user_idx FROM members WHERE user_id = ?";
                connection.query(selectQuery, user_id, function (err0, rows0) {
                    if (err0) {
                        console.log("Connection Error0 : " + err0);
                        res.status(500).send({ message: "Connection Error0 : " + err0 });
                        connection.release();
                    } else {
                        if (JSON.stringify(rows0) == "[]") {
                            res.status(400).send({ message: "wrong input - id" });
                            connection.release();
                        } else {
                            user_idx = rows0[0].user_idx;
                            console.log("user_idx : ", user_idx);

                            if (role == "client") {
                                selectQuery = "SELECT cost FROM current_tasks WHERE clients_members_idx = ?"
                                selectQuery2 = "SELECT helpers_members_idx FROM current_tasks WHERE clients_members_idx = ?"
                            } else if (role == "helper") {
                                selectQuery = "SELECT cost FROM current_tasks WHERE helpers_members_idx = ?"
                                selectQuery2 = "SELECT clients_members_idx FROM current_tasks WHERE helpers_members_idx = ?"
                            }
                            //상대방 idx 검색 - 이걸 빨리 떠올렸으면 이렇게 코드가 개판이 되지 않았을텐데 후 자살각이당..
                            connection.query(selectQuery2, user_idx, function (err01, rows01) {
                                if (err01) {
                                    console.log("Connection Error0.5 : ", err01);
                                    res.status(500).send({ message: "Connection Error0.5 : ", err01 });
                                    connection.release();
                                } else {
                                    if (JSON.stringify(rows01) != "[]") {
                                        if (role == "client") user_idx2 = rows01[0].helpers_members_idx;
                                        else user_idx2 = rows01[0].clients_members_idx;
                                        console.log("user_idx2 : ", user_idx2);

                                        //cost 확인겸 실제로 존재하는 임무인지 확인
                                        connection.query(selectQuery, user_idx, function (err1, rows1) {
                                            if (err1) {
                                                console.log("Connection Error1 : ", err1);
                                                res.status(500).send({ message: "Connection Error1 : ", err1 });
                                                connection.release();
                                            } else {
                                                //존재하는 임무인 경우
                                                if (JSON.stringify(rows1) != "[]") {
                                                    cost = rows1[0].cost;
                                                    console.log("cost : ", cost);
                                                    if (role == "client") {
                                                        selectQuery = "SELECT rating_h FROM past_tasks WHERE clients_members_idx = ? AND finish_time = ?";
                                                        insertQuery = "INSERT INTO past_tasks (clients_members_idx, helpers_members_idx, task_type, cost, details, home_lat, home_long, workplace_lat, workplace_long, matching_time) SELECT clients_members_idx, helpers_members_idx, task_type, cost, details, home_lat, home_long, workplace_lat, workplace_long, matching_time FROM current_tasks WHERE clients_members_idx = ?;";
                                                        deleteQuery = "DELETE FROM current_tasks WHERE clients_members_idx = ?";
                                                        updateQuery = "UPDATE past_tasks SET comment_c = ?, rating_c = ?, finish_time = ? WHERE finish_time = ? AND clients_members_idx = ?";
                                                        selectQuery2 = "SELECT task_idx FROM past_tasks WHERE finish_time = ? AND clients_members_idx = ?"
                                                    } else if (role == "helper") {
                                                        selectQuery = "SELECT rating_c FROM past_tasks WHERE helpers_members_idx = ? AND finish_time = ?";
                                                        insertQuery = "INSERT INTO past_tasks (clients_members_idx, helpers_members_idx, task_type, cost, details, home_lat, home_long, workplace_lat, workplace_long, matching_time) SELECT clients_members_idx, helpers_members_idx, task_type, cost, details, home_lat, home_long, workplace_lat, workplace_long, matching_time FROM current_tasks WHERE helpers_members_idx = ?;";
                                                        deleteQuery = "DELETE FROM current_tasks WHERE helpers_members_idx = ?";
                                                        updateQuery = "UPDATE past_tasks SET comment_h = ?, rating_h = ?, finish_time = ? WHERE finish_time = ? AND helpers_members_idx = ?";
                                                        selectQuery2 = "SELECT task_idx FROM past_tasks WHERE finish_time = ? AND helpers_members_idx = ?"
                                                    } else {
                                                        console.log("wrong input - role");
                                                        res.status(403).send({ message: 'wrong inout - role' });
                                                        connection.release();
                                                    }

                                                    //상대방이 별점 등록했는지 체크 - 내 idx와 매칭 타임으로 task 검색 - 둘이 복합키 느낌
                                                    let data1 = [user_idx, "0000-00-00 00:00:00"];
                                                    connection.query(selectQuery, data1, function (err2, rows2) {
                                                        if (err2) {
                                                            console.log("Connection Error2 : " + err2);
                                                            res.status(500).send({ message: "Connection Error2 : " + err2 });
                                                            connection.release();
                                                        } else {
                                                            console.log("별점 등록 여부 : ", JSON.stringify(rows2));

                                                            if (JSON.stringify(rows2) == "[]") {
                                                                //상대방이 아직 등록 안했으면
                                                                //current_tasks의 정보 past_tasks로 옮김 / 삭제는 안함
                                                                connection.query(insertQuery, user_idx, function (err3, rows3) {
                                                                    if (err3) {
                                                                        console.log("Connection Error3 : " + err3);
                                                                        res.status(500).send({ message: "Connection Error3 : " + err3 });
                                                                        connection.release();
                                                                    } else {
                                                                        console.log("정보 옮김!");
                                                                        console.log("별점을 등록 하자!1");

                                                                        let data2 = [user_comment, user_star, "0000-00-00 00:00:00", "0000-00-00 00:00:00", user_idx];
                                                                        connection.query(updateQuery, data2, function (err3, rows3) {
                                                                            if (err3) {
                                                                                console.log("Connection Error4 : " + err3);
                                                                                res.status(500).send({ message: "Connection Error4 : " + err3 });
                                                                                connection.release();
                                                                            } else {
                                                                                let star = [user_star, user_idx2];
                                                                                if (role == "helper") updateQuery = 'UPDATE clients SET rating = (rating+?), rated_count = (rated_count+1) WHERE user_idx = ?';
                                                                                else if (role == "client")  updateQuery = 'UPDATE helpers SET rating = (rating+?), rated_count = (rated_count+1) WHERE user_idx = ?';
                                                                                connection.query(updateQuery, star, function(err4,rows4) {
                                                                                    if (err4) {
                                                                                        console.log("Connection Error4 : " + err4);
                                                                                        res.status(500).send({ message: "Connection Error4 : " + err4 });
                                                                                        connection.release();
                                                                                    } else {
                                                                                        console.log("1차 별점 등록!");
                                                                                        res.status(200).send({ message: "Success -- 1" });
                                                                                        connection.release();
                                                                                    }
                                                                                });

                                                                            }
                                                                        });
                                                                    }
                                                                });
                                                            }
                                                            //등록했으면
                                                            else {
                                                                //pask_taskscurrent_task삭제
                                                                connection.query(deleteQuery, user_idx, function (err3, rows3) {
                                                                    if (err3) {
                                                                        console.log("Connection Error5 : " + err3);
                                                                        res.status(500).send({ message: "Connection Error5 : " + err3 });
                                                                        connection.release();
                                                                    } else {
                                                                        console.log("current 정보 삭제 완료!");
                                                                        console.log("별점을 등록 하자!2");
                                                                        //past_tasks의 task_idx 가져와서 저장
                                                                        let task_idx;
                                                                        let data2 = ["0000-00-00 00:00:00", user_idx];
                                                                        connection.query(selectQuery2, data2, function (err4, rows4) {
                                                                            if (err4) {
                                                                                console.log("Connection Error6 : " + err4);
                                                                                res.status(500).send({ message: "Connection Error6 : " + err4 });
                                                                                connection.release();
                                                                            } else {
                                                                                //이쯤 되면 예외처리 안해도 될듯 분명 존재하는 값
                                                                                task_idx = rows4[0].task_idx;
                                                                                console.log("task_idx : ", task_idx);

                                                                                //드디어 두번째 별점 등록! 엄청난 콜백 지옥!
                                                                                var newDate = new Date();
                                                                                var time = newDate.toFormat('YYYY-MM-DD HH24:MI:SS');
                                                                                console.log(time);
                                                                                let data3 = [user_comment, user_star, time, "0000-00-00 00:00:00", user_idx];
                                                                                connection.query(updateQuery, data3, function (err3, rows3) {
                                                                                    if (err3) {
                                                                                        console.log("Connection Error7 : " + err3);
                                                                                        res.status(500).send({ message: "Connection Error7 : " + err3 });
                                                                                        connection.release();
                                                                                    } else {
                                                                                        console.log("2차 별점 등록!");
                                                                                        //update구문으로 돈 바꿔야함 past_tasks에서 돈 가져와서 members에 update
                                                                                        //UPDATE members money = (money - ?) WHERE user_idx = ?
                                                                                        //상태 수정
                                                                                        if (role == "client")
                                                                                            updateQuery = "UPDATE clients SET status = ? WHERE user_idx = ?";
                                                                                        else
                                                                                            updateQuery = "UPDATE helpers SET status = ? WHERE user_idx = ?";
                                                                                        let data4 = ["A",  user_idx];
                                                                                        connection.query(updateQuery, data4, function (err5, rows5) {
                                                                                            if (err5) {
                                                                                                console.log("Connection Error8 : " + err5);
                                                                                                res.status(500).send({ message: "Connection Error8 : " + err5 });
                                                                                                connection.release();
                                                                                            } else {
                                                                                                if (role == "client") updateQuery = "UPDATE helpers SET status = ? WHERE user_idx = ?";
                                                                                                else updateQuery = "UPDATE clients SET status = ? WHERE user_idx = ?";
                                                                                                let data5 = ["A", user_idx2];
                                                                                                connection.query(updateQuery, data5, function (err5, rows5) {
                                                                                                    if (err5) {
                                                                                                        console.log("Connection Error9 : " + err5);
                                                                                                        res.status(500).send({ message: "Connection Error9: " + err5 });
                                                                                                        connection.release();
                                                                                                    } else {

                                                                                                        //돈 수정
                                                                                                        if (role == "client")
                                                                                                            updateQuery = "UPDATE members SET money = (money - ?) WHERE user_idx = ?";
                                                                                                        else
                                                                                                            updateQuery = "UPDATE members SET money = (money + ?) WHERE user_idx = ?";
                                                                                                        let data4 = [cost,  user_idx];
                                                                                                        connection.query(updateQuery, data4, function (err5, rows5) {
                                                                                                            if (err5) {
                                                                                                                console.log("Connection Error10 : " + err5);
                                                                                                                res.status(500).send({ message: "Connection Error10 : " + err5 });
                                                                                                                connection.release();
                                                                                                            } else {
                                                                                                                if (role == "client") updateQuery = "UPDATE members SET  money = (money + ?) WHERE user_idx = ?";
                                                                                                                else updateQuery = "UPDATE members SET  money = (money - ?)  WHERE user_idx = ?";
                                                                                                                let data5 = [cost, user_idx2];
                                                                                                                connection.query(updateQuery, data5, function (err5, rows5) {
                                                                                                                    if (err5) {
                                                                                                                        console.log("Connection Error9 : " + err5);
                                                                                                                        res.status(500).send({ message: "Connection Error9: " + err5 });
                                                                                                                        connection.release();
                                                                                                                    } else {
                                                                                                                        let star = [user_star, user_idx2];
                                                                                                                        if (role == "helper") updateQuery = 'UPDATE clients SET rating = (rating+?), rated_count = (rated_count+1) WHERE user_idx = ?';
                                                                                                                        else if (role == "client")  updateQuery = 'UPDATE helpers SET rating = (rating+?), rated_count = (rated_count+1) WHERE user_idx = ?';
                                                                                                                        connection.query(updateQuery, star, function(err4,rows4) {
                                                                                                                            if (err4) {
                                                                                                                                console.log("Connection Error4 : " + err4);
                                                                                                                                res.status(500).send({ message: "Connection Error4 : " + err4 });
                                                                                                                                connection.release();
                                                                                                                            } else {
                                                                                                                                console.log("2차 별점 등록!");
                                                                                                                                res.status(200).send({ message: "Success -- 1" });
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
                                                } else {
                                                    //current_tasks에 등록되ㅓㅇ있지 않은 사용자
                                                    res.status(400).send({ message: "wrong input - task" });
                                                    connection.release();
                                                }
                                            }
                                        });
                                    } else {
                                        console.log("wrong input - no match");
                                        res.status(403).send({ message: 'wrong inout - no match' });
                                        connection.release();

                                    }
                                }
                            });

                        }
                    }
                });
            }
        }
    });
});
//매칭 이벤트
//수행자가 수행하기 눌렀을때
//수행인 status 체크
//해당 임무 matching시간 체크해서 0000-00-00 00:00:00이먄 matching time 현재시간으로 업데이트
router.put('/matching', function (req, res) {
    pool.getConnection(function (error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.status(500).send("internal server error");
            connection.release();
        } else {
            let task_idx = req.query.task_idx;  let user_id = req.query.user_id;

            if (!(task_idx && user_id)) {
                res.status(400).send("internal server error");
                connection.release();
            } else {
                //수행 가능한 사람인지
                let selectQuery = 'SELECT h.status, m.user_idx FROM helpers h, members m WHERE m.user_idx = h.user_idx AND m.user_id = ?';
                connection.query(selectQuery, user_id, function (err, rows) {
                    if (err) {
                        console.log("Connection Error1 : " + err);
                        res.status(500).send("internal server error");
                        connection.release();
                    } else {
                        if (rows[0].status == "D") {
                            //이미 수행중인 사람이면
                            console.log("status == D");
                            res.status(405).send("internal server error");
                            connection.release();
                        } else if (rows[0].user_idx){
                            //수행가능한 사람이면 matching_time 체크 하고 테이블에 정보 삽입
                            let user_idx = rows[0].user_idx;
                            console.log("user_idx : ", user_idx);

                            let updateQuery = 'UPDATE current_tasks SET helpers_members_idx = ?, matching_time = ? WHERE task_idx = ? AND matching_time = ?';
                            var newDate = new Date();
                            var time = newDate.toFormat('YYYY-MM-DD HH24:MI:SS');
                            console.log("time : ", time);
                            let value = [user_idx, time, task_idx, "0000-00-00 00:00:00"];
                            connection.query(updateQuery, value, function (err2, rows2) {
                                if (err2) {
                                    console.log("Connection Error2 : " + err2);
                                    res.status(500).send("internal server error");
                                    connection.release();
                                } else {
                                    //수행자 상태 변경
                                    updateQuery = 'UPDATE helpers SET status = ? WHERE user_idx = ?'
                                    var value2 = ["D", user_idx];
                                    connection.query(updateQuery, value2, function (err4, rows4) {
                                        if (err4) {
                                            console.log("Connection Error4 : " + err4);
                                            res.status(500).send("internal server error");
                                            connection.release();
                                        } else {
                                            res.status(200).json({ message: "Success in matching" });
                                            connection.release();
                                        }
                                    });
                                }
                            });
                        }
                    }
                });
            }
        }
    });
});




//매칭시 팝업
router.put('/matching2', function (req, res) {
    pool.getConnection(function (error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.status(500).send("internal server error");
            connection.release();
        } else {
            let task_idx = req.query.task_idx;  let user_id = req.query.user_id;

            if (!(task_idx && user_id)) {
                res.status(400).send("internal server error");
                connection.release();
            } else {
                //수행 가능한 사람인지
                let selectQuery = 'SELECT h.status, m.user_idx FROM helpers h, members m WHERE m.user_idx = h.user_idx AND m.user_id = ?';
                connection.query(selectQuery, user_id, function (err, rows) {
                    if (err) {
                        console.log("Connection Error1 : " + err);
                        res.status(500).send("internal server error");
                        connection.release();
                    } else {
                        if (rows[0].status == "D") {
                            //이미 수행중인 사람이면
                            console.log("status == D");
                            res.status(405).send("internal server error");
                            connection.release();
                        } else if (rows[0].user_idx){
                            //수행가능한 사람이면 matching_time 체크 하고 테이블에 정보 삽입
                            let user_idx = rows[0].user_idx;
                            console.log("user_idx : ", user_idx);

                            let updateQuery = 'UPDATE current_tasks SET helpers_members_idx = ?, matching_time = ? WHERE task_idx = ? AND matching_time = ?';
                            var newDate = new Date();
                            var time = newDate.toFormat('YYYY-MM-DD HH24:MI:SS');
                            console.log("time : ", time);
                            let value = [user_idx, time, task_idx, "0000-00-00 00:00:00"];
                            connection.query(updateQuery, value, function (err2, rows2) {
                                if (err2) {
                                    console.log("Connection Error2 : " + err2);
                                    res.status(500).send("internal server error");
                                    connection.release();
                                } else {
                                    //수행자 상태 변경
                                    updateQuery = 'UPDATE helpers SET status = ? WHERE user_idx = ?'
                                    var value2 = ["D", user_idx];
                                    connection.query(updateQuery, value2, function (err4, rows4) {
                                        if (err4) {
                                            console.log("Connection Error4 : " + err4);
                                            res.status(500).send("internal server error");
                                            connection.release();
                                        } else {
											////디테일 정보, 수행자로 들어왔고 매칭이 되면 수행자의 정보를 팝업으로 넘겨주는거야.
											console.log("user_id :"+user_id);
											selectQuery = "select c.helpers_members_idx as h_id from current_tasks c, members m where c.helpers_members_idx = m.user_idx and m.user_id = ?";
											connection.query(selectQuery, user_id, function (err2, rows5) {
												if (err) {
													console.log("Connection Error2 : " + err2);
													res.status(500).send({ message: "Connection Error2 : " + err2 });
													connection.release();
												} else {
													console.log(rows5);
													console.log(rows5[0]);
													console.log(rows5[0].h_id);
													var u_id = rows5[0].h_id;
													//수행자 이름 별점 번호 수행횟수(총횟수) 이미지
													selectQuery = "SELECT m.user_name, (h.rating/h.rated_count) AS star, m.phone, h.rated_count, m.image_path FROM members m, helpers h WHERE m.user_idx = h.user_idx AND h.user_idx = ?"
													connection.query(selectQuery, u_id, function (err3, rows3){
														if (err3) {
															console.log("Connection Error2 : " + err3);
															res.status(500).send({ message: "Connection Error2 : " + err3 });
															connection.release();
														} else {
														////
																var matchingMessage=new gcm.Message({
																	collapseKey: 'BurnIt',
																	delayWhileIdle: true,
																	timeToLive: 3,

																	data:{
																		title: 'BurnIt',
																		message: '매칭되었습니다',
																		user_name: rows3[0].user_name,
																		star: rows3[0].star,
																	    phone: rows3[0].phone,
																		count: rows3[0].rated_count,
																		image_path: rows3[0].image_path
																	}
																});
																//토큰값의로 의뢰자의 아이디값을 넘겨주면, 일로 메세지가 간다.
																var token='dwdcgLMv6Xw:APA91bGE_9_5BL7yi1I_QPIojjJXsakMOMdgoNpOWUP81S1Sy45YDCIg6W774fG4SUTOxTm0qaAt6dXz1GxkGIKEewvtbCYfyoUZ7cH8r82tR1g77rqFQYk0mU0myvQwfinFt20Ln1rs';
																 
																registrationIds.push(token);

																sender.send(matchingMessage, registrationIds, 4, function(err, result){
																	console.log("dahoon pop up"+result);
																});

																res.status(200).json({ message: "Success in matching" });
																			connection.release();
														////
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
            }
        }
    });
});




//매칭중
//의뢰자가 자기 아이디로 임무 매칭시간 받아서 체크
router.get('/matching/check', function (req, res) {
    pool.getConnection(function (error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.status(500).send("getConnection Error" + error);
            connection.release();
        } else {
            let user_id = req.query.user_id;
            console.log("user_id : ", user_id);
            if (!user_id) {
                res.status(400).send({ message: 'wrong inout' });
                connection.release();
            } else {
                let selectQuery = 'SELECT t.matching_time FROM current_tasks t, members m WHERE t.clients_members_idx = m.user_idx AND m.user_id = ?'
                connection.query(selectQuery, user_id, function (err, rows) {
                    if (err) {
                        console.log("Connection Error1 : " + err);
                        res.status(500).send({ message: "Connection Error1 : " + err });
                        connection.release();
                    } else {
                        if (JSON.stringify(rows) == "[]") {
                            console.log(JSON.stringify(rows));
                            res.status(405).send({ message: '그런일 없수다' });
                            connection.release();
                        }
                        else {
                            res.status(200).send({ message: 'Success in selecting matching time', result: rows[0].matching_time });
                            connection.release();
                        }
                    }
                });
            }
        }
    });
});

//임무 취소
//current task에서 삭제
router.delete('/matching/cancel', function (req, res) {
    pool.getConnection(function (error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.status(500).send("getConnection Error" + error);
            connection.release();
        } else {
            let user_id = req.query.user_id; let role = req.query.role;
            let user_idx;
            let deleteQuery;
            console.log("user_id : ", user_id); console.log("role : ", role);

            if (!(user_id&&role)) {
                res.status(400).send({ message: 'wrong inout - qeury' });
                connection.release();
            } else {
                //user_idx 알아내기
                let selectQuery = 'SELECT user_idx FROM members WHERE user_id = ?';
                connection.query(selectQuery, user_id, function (err, rows) {
                    if (err) {
                        console.log("Connection Error1 : " + err);
                        res.status(500).send({ message: "Connection Error1 : " + err });
                        connection.release();
                    } else {
                        if (JSON.stringify(rows)=="[]") {
                            res.status(400).send({ message: '그런 사용자 없수다' });
                            connection.release();
                        } else {
                            console.log(rows[0]);
                            user_idx = rows[0].user_idx;
                            //user_idx로 current_tasks에서 task 삭제
                            if (role == "client")       deleteQuery = 'DELETE FROM current_tasks WHERE clients_members_idx = ?';
                            else if (role == "helper")  deleteQuery = 'DELETE FROM current_tasks WHERE helpers_members_idx = ?';
                            connection.query(deleteQuery, user_idx, function (err2, rows2) {
                                if (err2) {
                                    console.log("Connection Error2 : " + err2);
                                    res.status(500).send({ message: "Connection Error2 : " + err2 });
                                    connection.release();
                                } else {
                                    res.status(200).send({ message: "Success!" });
                                    connection.release();
                                }
                            });
                        }
                    }
                });
            }
        }
    });
});
router.get('/comments', function (req, res) {
    pool.getConnection(function (error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.status(500).send("getConnection Error" + error);
            connection.release();
        } else {
            let user_id = req.query.user_id; let role = req.query.role; let user_idx;
            console.log("user_id : ", user_id); console.log("role : ", role);

            if (!(user_id&&role)) {
                res.status(400).send({ message: 'wrong input - query' });
                connection.release();
            } else {
                //user_idx 알아내기
                let selectQuery = 'SELECT user_idx FROM members WHERE user_id = ?';
                connection.query(selectQuery, user_id, function (err, rows) {
                    if (err) {
                        console.log("Connection Error1 : " + err);
                        res.status(500).send({ message: "Connection Error1 : " + err });
                        connection.release();
                    } else {
                        if (JSON.stringify(rows)=="[]") {
                            res.status(400).send({ message: '그런 사용자 없수다' });
                            connection.release();
                        } else {
                            user_idx=rows[0].user_idx;
                            if (role == "client")      selectQuery ='SELECT matching_time, rating_h, comment_h FROM past_tasks WHERE clients_members_idx = ?';
                            else if (role == "helper") selectQuery ='SELECT matching_time, rating_c, comment_c FROM past_tasks WHERE helpers_members_idx = ?';
                            connection.query(selectQuery, user_idx, function (err, rows) {
                                if (err) {
                                    console.log("Connection Error1 : " + err);
                                    res.status(500).send({ message: "Connection Error1 : " + err });
                                    connection.release();
                                } else {
                                    res.status(200).send({ message: "Success", result:rows});
                                    connection.release();
                                }
                            });
                        }
                    }
                });
            }
        }
    });
});
module.exports = router;
