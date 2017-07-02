var express = require('express');
var app = express();
var task= require('./routes/task');
var navi= require('./routes/navi');

app.use('/task', task);
app.use('/navi', navi);

app.listen(3000, function(){
  console.log("3000번으로 구동중");
});
