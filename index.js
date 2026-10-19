require('dotenv').config();
const jwt = require('jsonwebtoken');

const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-z4lejrv-shard-00-00.t7hbkhr.mongodb.net:27017,ac-z4lejrv-shard-00-01.t7hbkhr.mongodb.net:27017,ac-z4lejrv-shard-00-02.t7hbkhr.mongodb.net:27017/?ssl=true&replicaSet=atlas-o8z6bn-shard-0&authSource=admin&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

app.get('/', (req, res) => {
    res.send('mart server is running');
});


// ✅ JWT VERIFY MIDDLEWARE (ONLY ONE)
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized Access' });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized Access' });
        }

        req.decoded = decoded;
        next();
    });
};


async function run() {
    try {
        await client.connect();
        console.log("MongoDB Connected ✅");

        const db = client.db("mart_db");
        const productsCollection = db.collection('products');
        const usersCollection = db.collection('users');

        // 🔐 JWT create
        app.post('/jwt', async (req, res) => {
            const user = req.body;

            const token = jwt.sign(
                { email: user.email },   // ONLY EMAIL
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.send({ token });
        });

        // 👤 Users
        app.post('/users', async (req, res) => {
            const newUsers = req.body;

            const query = { email: req.body.email };

            const existingUser = await usersCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: "User Already exist" });
            }

            const result = await usersCollection.insertOne(newUsers);
            res.send(result);
        });

        app.get('/users', async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users);
        });

        // 📦 Products
        app.post('/products', async (req, res) => {
            const result = await productsCollection.insertOne(req.body);
            res.send(result);
        });

        app.get('/products', async (req, res) => {
            const result = await productsCollection.find().toArray();
            res.send(result);
        });

        app.get('/latest-products', async (req, res) => {
            const result = await productsCollection
                .find()
                .sort({ createdAt: -1 })
                .limit(5)
                .toArray();

            res.send(result);
        });

        // 🔐 PROTECTED ROUTE
        app.get('/myProducts/:email', verifyToken, async (req, res) => {

            const email = req.params.email;

            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

            const result = await productsCollection.find({
                sellerEmail: email
            }).toArray();

            res.send(result);
        });

        await client.db("admin").command({ ping: 1 });
        console.log("MongoDB Connected Successfully 🚀");

    } finally {
        // optional
    }
}

run().catch(console.dir);

app.listen(PORT, () => {
    console.log(`server running on port ${PORT}`);
});