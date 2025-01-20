const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
    res.send('Hello World!')
})



const uri = `mongodb+srv://${process.env.ADOPTION_USER}:${process.env.ADOPTION_PASS}@cluster0.xdjfp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const db = client.db('petAdoption')
        const petsCollection = db.collection('pets')
        const userCollection = db.collection('users')
        const adoptionRequestCollection = db.collection('adoption-request')
        // post new user
        app.post('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = req.body
            console.log(user)
            const isExist = await userCollection.findOne(query)

            if (isExist) {
                return res.send(isExist)
            }
            // const myUser = {...user}
            const result = await userCollection.insertOne({ ...user, role: 'user', timestamp: Date.now() })
            res.send(result)

        })


        // get pets search and category
        app.get('/pets', async (req, res) => {
            const search = req.query.search
            const category = req.query.category
            console.log(category)
            let query;
            if(category){
                query = {category}
                
            } 

            if (search) {
                const option = { name: { $regex: search, $options: 'i' } }
                const result = await petsCollection.find(option).toArray()
                return res.send(result)
            }
            
            
            const result = await petsCollection.find(query).toArray()
            res.send(result)
        })
        // get pets category
        app.get('/pets/:category', async (req, res) => {
            let category = req.params.category;
            let query = {category};
            
            const result = await petsCollection.find(query).toArray()
            res.send(result)
        })

        // get Pets specific id
        app.get('/details/:id', async (req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await petsCollection.findOne(query)
            res.send(result)
            // console.log(result)
        })

        // post adoption request
        app.post('/adoptionRequest/', async(req, res) => {
            const petId = req.body.petId
            const email = req.body.user.email
            const requestData = req.body
            const query = {'user.email': email, petId}
            const isExist = await adoptionRequestCollection.findOne(query)
            // const requestData = req.body;
            if(isExist){
                return res.status(400).send('You have already requested.')
            }

            
            const result = await adoptionRequestCollection.insertOne(requestData)
            res.send(result)
            console.log(isExist)
            console.log(email)
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})