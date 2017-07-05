var express = require('express');
var app = express();
var task= require('./routes/task');
var navi= require('./routes/navi');
var auth= require('./routes/auth');

app.use('/task', task);
app.use('/navi', navi);
app.use('/auth', auth);

app.listen(3000, function(){
  console.log("3000번으로 구동중");
});
