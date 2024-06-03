import express from 'express';
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import dotenv from 'dotenv';

const saltRounds = 10;
const app = express();
const port = 3000;

dotenv.config();

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: process.env.POSTGRES_DB,
    password:  process.env.POSTGRES_PWD,
    port: process.env.POSTGRES_PORT,
  });
  
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));

//check
app.get('/',(req,res)=>{
    res.status(200).send("get success!");
});

//get all ideas
app.get("/all-ideas",async (req,res)=>{
    try{
        //console.log("get all ideas");
        const result = await db.query("SELECT * FROM ideas ORDER BY id ASC;");
        const all_ideas = result.rows;
        res.status(200).json({ideas : all_ideas});
    }catch(e){
        console.log(e.message);
        res.status(400).json({error: e.message});
    }
});

// get all ideas of an user
app.get("/my-ideas/:id",async (req,res)=>{
    try{
        console.log("get ideas of a user");
        const id = parseInt(req.params.id);
        const result = await db.query("SELECT * FROM ideas WHERE user_id=$1;",[id]);
        const my_ideas = result.rows;
        res.status(200).json({ideas : my_ideas});
    }catch(e){
        console.log(e.message);
        res.status(400).json({error: e.message});
    }
});

//register
app.post("/register", async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const type = req.body.type;
    const email = req.body.email;
  
    try {
      const checkResult = await db.query("SELECT * FROM users WHERE email = $1 and type = $2", [
        email,type
      ]);
  
      if (checkResult.rows.length > 0) {
        res.send("User already exists. Try logging in.");
      } else {

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        const result = await db.query(
            "INSERT INTO users (username, password, type, email) VALUES ($1, $2, $3, $4)",
            [username, hashedPassword, type, email]
          );
          console.log(result.rows);
          res.status(200).send("Registration Successful!");
      }
    } catch (err) {
      console.log(err);
    }
});

//login
app.post("/login", async (req, res) => {
    const email = req.body.email;
    const loginPassword = req.body.password;
  
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1", [
        email,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;

        const isValidPassword = bcrypt.compare(loginPassword,storedHashedPassword);

        if(isValidPassword){
            res.status(200).json({ message: 'Login successful!' });
        }
        else{
            res.status(400).json({ message: 'Incorrect password!' });
        }
      } else {
        res.send("User not found");
      }
    } catch (err) {
      console.log(err);
    }
});

//post an idea
app.post("/post", async (req,res)=>{
    //todo: check if user exists
    try{
        //console.log("post a idea");
        const {user_id, title, content} = req.body;
        console.log
        const result = await db.query("INSERT INTO ideas (user_id,title,content,likes,views) VALUES ($1,$2,$3,0,0) RETURNING *;",
        [user_id, title,content]);
        console.log("idea saved!");
        res.status(200).json({newIdea:result.rows});
    }catch(e){
        console.log(e.message);
        res.status(400).json({error: e.message});
    }
});

// Send friend request
app.post('/send-request', async (req, res) => {
  const { user1_id, user2_id } = req.body;

  try {
    const result = await db.query(
      'INSERT INTO friends (user1_id, user2_id, created_at) VALUES ($1, $2, NOW()) RETURNING *',
      [user1_id, user2_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Accept friend request
app.post('/accept-request', async (req, res) => {
  const { user1_id,user2_id } = req.body;

  try {
    const result = await db.query(
      'UPDATE friends SET status = $1 WHERE user1_id = $2 and user2_id = $3 RETURNING *',
      ['accepted', user1_id,user2_id]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject friend request
app.post('/reject-request', async (req, res) => {
  const { user1_id,user2_id } = req.body;

  try {
    const result = await db.query(
      'DELETE FROM friends WHERE user1_id = $1 AND user2_id = $2 RETURNING *',
      [user1_id, user2_id]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// View all friends
app.get('/friends/:user_id', async (req, res) => {
  const { user_id } = req.params;

  try {
    const result = await db.query(
      `SELECT * FROM friends 
       WHERE (user1_id = $1 OR user2_id = $1) AND status = $2`,
      [user_id, 'accepted']
    );
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//view pending requests sent by current user
app.get('/pending-requests/:user_id', async (req, res) => {
  const { user_id } = req.params;

  try {
    const result = await db.query(
      `SELECT * FROM friends 
       WHERE user1_id = $1 AND status = $2`,
      [user_id, 'pending']
    );
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//view pending requests received by current user
app.get('/received-requests/:user_id', async (req, res) => {
  const { user_id } = req.params;

  try {
    const result = await db.query(
      `SELECT * FROM friends 
       WHERE user2_id = $1 AND status = $2`,
      [user_id, 'pending']
    );
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, ()=>{
    console.log(`Server running on port ${port}`);
});