require('dotenv').config()
const express = require('express')
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 3000

app.use(cors({
    origin: ['http://localhost:5173', 'https://petadoptionass-12.web.app'],
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
        // console.log(decoded)
        next()
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const db = client.db('petAdoption')
        const petsCollection = db.collection('pets')
        const userCollection = db.collection('users')
        const donationsCollection = db.collection('Donation-Campaigns')
        const donationDetailsCollection = db.collection('Donation-Details')
        // post new user



        // use Verify admin
        const verifyAdmin = async (req, res, next) => {
            const email = req.user?.email
            const query = { email }
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === 'Admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'Forbidden Access' })
            }
            next()
        }

        app.get('/user/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            if (email !== req.user?.email) {
                return res.status(403).send({ message: 'unauthorized' })
            }
            const query = { email }
            const user = await userCollection.findOne(query)

            let admin = false
            if (user) {
                admin = user?.role === 'Admin'
            }
            res.send({ admin })
            // console.log(req.user.email)
        })
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


        // get pets category
        app.get('/petsHome', async (req, res) => {
            let category = req.query.category;
            let query;
            if (category) {
                query = { category }
            }

            const result = await petsCollection.find(query).toArray()
            const filterPets = result.filter(pet => pet.adopted !== true)
            res.send(filterPets)
        })



        // get pets search and category
        // app.get('/pets', async (req, res) => {
        //     const search = req.query.search
        //     const category = req.query.category
        //     let query;
        //     if (category) {
        //         query = { category }
        //     }

        //     if (search) {
        //         const option = { name: { $regex: search, $options: 'i' } }
        //         const result = await petsCollection.find(option).sort({ date: -1 }).toArray()

        //         return res.send(result)
        //     }

        //     const result = await petsCollection.find(query).sort({ date: -1 }).toArray()
        //     const filterPets = result.filter(pet => pet.adopted !== true)
        //     // console.log(filterPets)
        //     res.send(filterPets)
        // })


        app.get('/pets', async (req, res) => {
            const search = req.query.search;
            const category = req.query.category;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 6;

            let query = {};

            if (category) {
                query.category = category;
            }

            if (search) {
                query.name = { $regex: search, $options: 'i' };
            }

            try {

                const result = await petsCollection
                    .find(query)
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .sort({ date: -1 })
                    .toArray();


                const totalPets = await petsCollection.countDocuments(query);
                const totalPages = Math.ceil(totalPets / limit);
                const nextPage = page < totalPages ? page + 1 : null;

                const filterPets = result.filter(pet => pet.adopted !== true); // Adopted pet বাদ দেয়া

                res.json({
                    results: filterPets,
                    nextPage: nextPage,
                });
            } catch (err) {
                console.error('Error fetching pets:', err);
                res.status(500).json({ message: 'Server Error' });
            }
        });


        // get 3 Active donation campaign
        app.get('/threePets', async (req, res) => {
            const result = await donationsCollection.find().limit(3).toArray()
            const filter = result.filter(pet => pet.adopted !== false)
            // console.log(filter)
            res.send(filter)
        })

        // get Pets specific id
        app.get('/details/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await petsCollection.findOne(query)
            res.send(result)
        })

        // patch adoption request
        app.patch('/adoptionRequest/:id', verifyToken, async (req, res) => {
            const id = req.params.id
            const email = req.body.adoptReqUserInfo.email
            const requestData = req.body
            const query = { _id: new ObjectId(id) }
            const isRequested = await petsCollection.findOne(query)
            // console.log(requestData)
            if (!email) {
                res.status(400).send('Login First')
                return
            }

            if (isRequested.adopted) {
                res.status(400).send('Already requested')
                return
            }

            const updateDoc = {
                $set: {
                    adoptionStatus: requestData.adoptionStatus,
                    adoptReqUserInfo: {
                        name: requestData.adoptReqUserInfo.name,
                        email: requestData.adoptReqUserInfo.email,
                        phone: requestData.adoptReqUserInfo.phone,
                        address: requestData.adoptReqUserInfo.address
                    },
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
            const sortPrice = req.query.sortPrice
            let sort = { createDate: -1 };
            // console.log(sortPrice)

            // if (category) {
            //     query.category = category;
            // }

            // console.log(sortPrice)
            if (sortPrice === 'Descending') {
                sort = { max_donation_amount: -1 };
            }

            if (sortPrice === 'Ascending') {
                sort = { max_donation_amount: 1 };
            }
            const result = await donationsCollection.find().sort(sort).toArray()
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
        app.patch('/petAdopted/:id', verifyToken, async (req, res) => {
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
        app.patch('/pauseDonation/:id', verifyToken, async (req, res) => {
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
            // console.log(pause)
        })

        app.patch('/unpauseDonation/:id', verifyToken, async (req, res) => {
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
            // console.log(pause)
        })

        // pause Donation
        app.patch('/unPausedDonation/:id', verifyToken, async (req, res) => {
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
        })

        // Edit Donation        
        app.patch('/editDonation/:id', verifyToken, async (req, res) => {
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
            // console.log(query)
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


        // Payment intent
        app.post('/create-payment-intent', verifyToken, async (req, res) => {
            const { amount, donationId } = req.body;
            const donation = await donationsCollection.findOne({ _id: new ObjectId(donationId) })
            if (!donation) {
                return res.status(400).send({ message: 'Donation Not Found!' })
            }

            const amountInCent = parseInt(amount) * 100
            const { client_secret } = await stripe.paymentIntents.create({
                amount: amountInCent,
                currency: 'usd',
                automatic_payment_methods: {
                    enabled: true,
                },
            });
            res.send({ clientSecret: client_secret })
            // console.log({ clientSecret: client_secret })
        })

        // post donation campaign for single donation
        app.post('/add-donation', verifyToken, async (req, res) => {
            const donationsDetails = req.body;
            const result = await donationDetailsCollection.insertOne(donationsDetails)

            const findPet = await donationsCollection.findOne({ _id: new ObjectId(donationsDetails.petId) })

                let updateDoc;
                if(findPet.totalDonation){
                    updateDoc = {
                        $set: {
                            totalDonation: donationsDetails.donarInfo.amount + findPet.totalDonation
                        }
                    }
                }else{
                    updateDoc = {
                        $set: {
                            totalDonation: donationsDetails.donarInfo.amount
                        }
                    }
                }
                
                await donationsCollection.updateOne({ _id: new ObjectId(donationsDetails.petId)}, updateDoc, { upsert: true })
            
            res.send(result)
            // console.log(donationsDetails)
            // const donationData
        })

        app.get('/myDonationsInPet/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { 'donarInfo.email': email }
            const result = await donationDetailsCollection.find(query).toArray()
            res.send(result)
        })

        // get userShow donations
        app.get('/donationUser/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { petId: id }
            const result = await donationDetailsCollection.find(query).toArray()
            res.send(result)
            // console.log(query)
        })

        // admin panel get all users
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })

        // get all pets
        app.get('/allPets', verifyToken, verifyAdmin, async (req, res) => {
            const result = await petsCollection.find().toArray()
            res.send(result)
        })

        // get Donar Details
        app.get('/donarDetails/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { petId: id }
            const result = await donationDetailsCollection.find(query).toArray()
            res.send(result)
            // console.log(query)
        })

        // get all donations
        app.get('/allDonations', verifyToken, verifyAdmin, async (req, res) => {
            const result = await donationsCollection.find().toArray()
            res.send(result)
        })

        // delete campaigns
        app.delete('/deleteCampaigns/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await donationsCollection.deleteOne(query)
            res.send(result)
        })

        // All Donation Details
        app.get('/allDonations/:id', async (req, res) => {
            const id = req.params.id
            const result = await donationDetailsCollection.find({ petId: id }).toArray()
            res.send(result)
        })


        // make admin user
        app.patch('/makeAdmin/:email', async (req, res) => {
            const email = req.params.email
            const { role } = req.body;
            const query = { email }
            const updateDoc = {
                $set: {
                    role: role
                }
            }
            const result = await userCollection.updateOne(query, updateDoc)
            res.send(result)
        })








        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
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