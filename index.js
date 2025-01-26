const express = require('express')
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000

app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true,
    optionalSuccessStatus: 200
}))
app.use(express.json())
app.use(cookieParser())

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


const verifyToken = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
        }

        req.user = decoded
        next()
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const db = client.db('petAdoption')
        const petsCollection = db.collection('pets')
        const userCollection = db.collection('users')
        const donationsCollection = db.collection('Donation-Campaigns')
        // post new user


        // JWT
        // Generate Token
        app.post('/jwt', async (req, res) => {
            const email = req.body;
            const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5h' })

            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
            })
                .send({ success: true })
        })
        // Logout and remove token
        app.post('/logout', async (req, res) => {
            res.clearCookie('token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
            })
                .send({ success_logout: true })
        })

        app.post('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = req.body
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
            let query;
            if (category) {
                query = { category }

            }

            if (search) {
                const option = { name: { $regex: search, $options: 'i' } }
                const result = await petsCollection.find(option).sort({ date: -1 }).toArray()
                return res.send(result)
            }


            const result = await petsCollection.find(query).sort({ date: -1 }).toArray()
            res.send(result)
        })
        // get pets category
        app.get('/pets/:category', async (req, res) => {
            let category = req.params.category;
            let query = { category };

            const result = await petsCollection.find(query).toArray()
            res.send(result)
        })

        // get Pets specific id
        app.get('/details/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await petsCollection.findOne(query)
            res.send(result)
        })

        // patch adoption request
        app.patch('/adoptionRequest/:id', async (req, res) => {
            const id = req.params.id
            const email = req.body.adoptReqUserInfo.email
            const requestData = req.body
            const query = { _id: new ObjectId(id) }
            const isRequested = await petsCollection.findOne(query)
            console.log(email)
            if(!email){
                 res.status(400).send('Login First')
                 return
            }

            if(isRequested){
                 res.status(400).send('Already requested')
                 return
            }
            
            
            console.log('return')
            const updateDoc = {
                $set: {
                    adoptReqUserInfo: {
                        user_name: requestData.name,
                        email: requestData.email,
                        phone: requestData.phone,
                        address: requestData.address
                    }
                }
            }
            const result = await petsCollection.updateOne(query, updateDoc)
            res.send(result)
        })

        // Post Donation Campaigns
        app.post('/addDonationCampaign', verifyToken, async (req, res) => {
            const campaign = req.body;
            const result = await donationsCollection.insertOne(campaign)
            res.send(result)
        })

        // get Donation Campaigns Data
        app.get('/donations', async (req, res) => {
            const result = await donationsCollection.find().sort({ date: -1 }).toArray()
            res.send(result)
        })

        // get specific donationCampaign
        app.get('/donationDetails/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await donationsCollection.findOne(query)
            res.send(result)
        })

        // new pet data post
        app.post('/addedPet', verifyToken, async (req, res) => {
            const pet = req.body;
            const result = await petsCollection.insertOne(pet)
            res.send(result)
        })

        // get My Pets Data
        app.get('/myPets/:email', verifyToken, async (req, res) => {
            const decodedEmail = req.user?.email;
            const email = req.params.email;


            if (decodedEmail !== email) {
                return res.status(401).send({ message: 'unauthorized' })
            }

            const query = { email }
            const result = await petsCollection.find(query).toArray()
            res.send(result)
        })

        app.delete('/removeMyPet/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await petsCollection.deleteOne(query)
            res.send(result)
        })

        app.patch('/updatePet/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateData = req.body
            // const result = await petsCollection.findOne()
            const updateDoc = {
                $set: {
                    image: updateData.image,
                    name: updateData.name,
                    age: updateData.age,
                    location: updateData.location,
                    category: updateData.category,
                    updateDate: Date.now()
                }
            }
            const result = await petsCollection.updateOne(query, updateDoc)

            res.send(result)
        })

        // change adopted true or false
        app.patch('/petAdopted/:id',verifyToken, async (req, res) => {
            const data = req.body;
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    adoptionStatus: data.adoptionStatus,
                    adopted: data.adopted
                }
            }
            const result = await petsCollection.updateOne(query, updateDoc)
            res.send(result)
        })

        // get my pet donation data
        app.get('/myDonationPets/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const result = await donationsCollection.find(query).toArray()
            res.send(result)
        })

        // pause Donation
        app.patch('/pauseDonation/:id',verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const { pause } = req.body
            const updateDoc = {
                $set: {
                    pause: pause
                }
            }
            const result = await donationsCollection.updateOne(query, updateDoc)
            res.send(result)
            console.log(pause)
        })

        // Edit Donation        
        app.patch('/editDonation/:id',verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const data = req.body
            const updateDoc = {
                // todo
                $set: {
                    max_donation_amount: data.max_donation_amount,
                    lastDateOfDonation: data.lastDateOfDonation,
                    name: data.name,
                    image: data.imageUrl,
                    shortDescription: data.shortDescription,
                    longDescription: data.longDescription,
                    updateDate: new Date(),
                }
            }
            const result = await donationsCollection.updateOne(query, updateDoc)
            res.send(result)
            console.log(query)
        })


        // get My adopt request petData
        app.get('/myAdoptionRequest/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { 
                email: email,
                adoptReqUserInfo: { $exists: true },
            }
            // console.log(adoptReqUserInfo)
            const result = await petsCollection.find(query).toArray()
            res.send(result)
        })


        // get my Donations In Pet
        // app.get('/myDonationsInPet/:email', async (req, res) => {
        //     const email = req.params.email;
        //     const query = {'adoptReqUserInfo.email': email}
        //     // const result = await petsCollection.find(query).toArray()
        //     res.send(result)
        // })
        // manage user adoption request
        // app.patch('/adopt-request/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const requestData = req.body;
        //     const query = {_id: new ObjectId(id)}
        //     const result = await petsCollection.find()
        // })

        // app.patch('/myAddedPet/:id', async (req, res) => {
        //     const id = req.params.id
        //     const data = req.body
        //     const email = data.email
        //     const filter = {_id: new ObjectId(id)}
        //     const result = await petsCollection.findOne(filter)


        // })


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