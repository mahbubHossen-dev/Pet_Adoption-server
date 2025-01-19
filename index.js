const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
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

        app.get('/pets', async (req, res) => {
            const result = await petsCollection.find().toArray()
            res.send(result)
        })
        app.get('/pets/:category', async(req, res) => {
            let category = req.params.category;
            let query;
            if(category === 'Cats'){
                category = 'cat'
                query = {pet_category: category} 
            }
            if(category === 'Dogs'){
                category = 'dog'
                query = {pet_category: category} 
            }
            if(category === 'Birds'){
                category = 'bird'
                query = {pet_category: category} 
            }
            if(category === 'Fish'){
                category = 'fish'
                query = {pet_category: category} 
            }
            const result =await petsCollection.find(query).toArray()
            res.send(result)

            console.log(category)
            console.log(result)
            // const result = await petsCollection.find().toArray()
            // res.send(result)
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