const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const task= require('./routes/task');
const navi= require('./routes/navi');

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.text());

app.use('/task', task);
app.use('/navi', navi);

app.listen(3000, function(){
  console.log("3000번으로 구동중");
});
