var express = require('express');
var router = express.Router();
const jwt = require('jsonwebtoken');
const cookieParser = require("cookie-parser");
const {S3Client, PutObjectCommand} = require("@aws-sdk/client-s3");
const multer = require("multer");

//Webhook for sending upload alerts to
const webhook =process.env.DISCORD_WEBHOOK;
//Secret used for verifying JSON web tokens
const jwtToken = process.env.JSON_WEB_SECRET;
//Global password for signing in
const password = process.env.PASSWORD;
//Secret used for verifying signed cookies
const cookieSecret = process.env.COOKIE_SECRET;

const { Readable } = require('stream');



const S3 = new S3Client({
    region: "auto", // Required by SDK but not used by R2
    // Provide your Cloudflare account ID
    endpoint: process.env.R2_ENDPOINT,
    // Retrieve your S3 API credentials for your R2 bucket via API tokens (see: https://developers.cloudflare.com/r2/api/tokens)
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY,
        secretAccessKey: process.env.R2_SECRET,
    },
});



/* GET users listing. */
router.get('/', function(req, res, next) {
    try{

        let token = req.cookies.login;
        console.log(token)
        const data = jwt.verify(token, jwtToken);
        res.render("portal", {username: data, message: ""
        })
    }
    catch(error)
    {
        console.log(error)
        res.redirect("/")
    }
});

router.get('/login', function (req, res, next) {
    let user = req.query.name;
    let pass = req.query.password;
    console.log(user + pass)
    if(req.query.password !== password)
    {
        return res.redirect("/");
    }
    jwt.sign(user, jwtToken,(err, token) => {
        if(err) { console.log(err)}
        res.cookie("login", token)
        res.redirect("/dash");
})});

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/upload", upload.single("file"), async (req, res) => {
    const file = req.file;
    let name;
    try{

        let token = req.cookies.login;
        console.log(token)
        name = jwt.verify(token, jwtToken);
    }
    catch(error)
    {
        console.log(error)
        return res.status(403);
    }
    if (!file) return res.status(400).json({ message: "No file uploaded" });
    let URLName = `${name}-${Date.now()}-voicenote-${file.originalname}`
    const params = {
        Bucket: "deltarune-portal",
        Key: URLName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: "public-read" // or use "private"
    };

    try {
        const command = new PutObjectCommand(params);
        await S3.send(command);
        res.render("portal", {
            username: name,
            message: "Successfully uploaded file!"
        })
    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ message: "Upload failed", error: error.message });
    }
    await logDc(URLName);
});

async function logDc(message)
{
    try{
        let color = "255"
        const post = await fetch(webhook, {
            method: "POST",
            headers:{

                "Content-Type": "application/json"},
            body: JSON.stringify({
                "embeds": [{
                    "author": {
                        "name": "File upload!!!!",
                        "icon_url": "https://media.tenor.com/hRrV5cps_twAAAAi/cat-silly.gif"
                    },
                    "title": `New file upload!!`,
                    "color": color,
                    "description": ` https://storage.deltarune.pbsi.xyz/${message}`
                }]
            })
        });
        if(!post.ok)
        {
            console.log(post)
            console.log(await post.json)
        }
    }
    catch(error)
    {
        console.log(error)
    }

}


module.exports = router;
