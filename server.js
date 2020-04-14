const express = require('express');
const cors = require('cors');
const knex = require('knex');
const bcrypt = require('bcrypt-nodejs');
const clarifai = require('clarifai');
const { Client } = require('pg');



const clarifaiapp = new Clarifai.App({
 apiKey: 'fd5c3b4ffc544a6da693022f51181a9c'
});

const app = express()
app.use(express.json());
app.use(cors());

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0; 
const pgdb = knex({
  client: 'pg',
  connection: {
    connectionString : process.env.DATABASE_URL,
   	ssl: true,
  }
});

app.get ('/', (req,res) => {res.send("its working !!")})
app.post('/signin', (req,res) => {
	pgdb.select('email','hash').from('login').where('email', '=', req.body.email)
	.then(data => {
		const isvalid = bcrypt.compareSync(req.body.password, data[0].hash);
		if (isvalid) {
			return pgdb.select('*').from('users').where('email', '=', req.body.email)
			.then (user => res.json(user[0]))
			.catch(err => res.status(400).json('unable to get the user'))
		} else {
			res.status(400).json("wrong credentials")
		}
	})
	.catch(err => res.status(400).json("wrong credentials"))
});

app.post ('/register', (req,res) => {
	const { name, dateofbirth, email, password } = req.body;
	const hash = bcrypt.hashSync(password);
	pgdb.transaction(trx => {
		return trx('login')
		.returning('email')
		.insert({
			email : email,
			hash : hash
		})
		.then (loginemail => {
			return trx('users')    //need to return the trx.
			.returning('*')
			.insert({
				name : name,
				dateofbirth : dateofbirth,
				email : loginemail[0],
				joined : new Date()
			})
			.then(user => res.json(user[0]))
		})
		.then(trx.commit)
		.catch(trx.rollback)
	})
	.catch(err => res.status(400).json("Sorry the email is already registered"))
});

app.get ('/profile/:id', (req,res) => {

	const id = req.params.id
	pgdb.select('*').from('users').where({id : id})
	.then(user => {
		if(user.length) {
			res.json(user)
		} else {
			res.status(400).json("user not found")
		}
	})
	.catch( err=> res.json("Something went wrong"));
});

app.put('/image', (req,res) => {
	const {id} = req.body
	pgdb('users').where('id', '=', id)
	.increment('entries',1)
	.returning('entries')
	.then(count => {
		res.json(count[0]);
		})
	.catch(err => res.status(400).json("unable to get entries"))
		
});

app.post('/imageurl', (req,res) => {
	const {input} = req.body
	clarifaiapp.models.predict(Clarifai.FACE_DETECT_MODEL, input)
	.then(data => res.json(data))

})


app.listen(process.env.PORT || 3001, ()=> {
	console.log(`app is running on port ${process.env.PORT}`)
})









