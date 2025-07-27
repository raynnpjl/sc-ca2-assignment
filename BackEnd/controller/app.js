var express = require('express');
var bodyParser = require('body-parser')
const fs = require('fs')
const path = require('path')
var cors = require('cors');
const multer = require('multer')
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/images/product')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        let extArray = file.mimetype.split("/");
        let extension = extArray[extArray.length - 1];
        cb(null, file.fieldname + '-' + uniqueSuffix + "." + extension)
    }
})
const upload = multer({ storage: storage })
const validator = require('validator');

var userDB = require('../model/user');
const categoryDB = require('../model/category');
const productDB = require('../model/product');
const reviewDB = require('../model/review');
const discountDB = require('../model/discount');
const productImagesDB = require('../model/productimages');
// var verifyToken = require('../auth/verifyToken.js');
const { requireAuth, requireAdmin } = require('../auth/verifySession.js');
const orderDB = require('../model/orders');
const bcryptMiddleware = require('../middleware/bcryptMiddleware.js');
const sessionMiddleware = require('../middleware/sessionMiddleware.js');


var app = express();
app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true // allow cookies
}));
var urlencodedParser = bodyParser.urlencoded({ extended: false })

app.use(urlencodedParser);
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, '../public/')));
app.use(sessionMiddleware);

//Get if user is logged in with correct token
app.post('/user/isloggedin', (req, res) => {
    if (req.session.user) {
        res.status(200).json({
            userid: req.session.user.userid,
            type: req.session.user.type
        });
    } else {
        res.status(401).json({ Message: "Not logged in" })
    }
});

//Get order
app.get('/order/:userid', requireAuth, (req, res) => {

    orderDB.getOrder(req.userid, (err, results) => {
        if (err)
            res.status(500).json({ result: "Internal Error" })

        else {
            res.status(200).send(results);
        }

    })
});

//Add Order
app.post('/order', requireAuth, (req, res) => {

    const cart = req.session.cart;
    if (!cart || cart.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
    }

    // Calculate total server-side for safety
    let total = 0;
    cart.forEach(item => {
        total += item.price * item.quantity; // or your discounted price logic here
    });

    orderDB.addOrder(req.userid, JSON.stringify(cart), total, (err, results) => {
        if (err) {
            if (err?.message)
                res.status(400).json({ message: err?.message });
            else
                res.status(500).json({ message: "Internal Error" });
        } else {
            // Clear cart after order placed
            req.session.cart = [];

            res.status(201).json({ orderid: results.insertId });
        }
    });
});
 

//Update product
app.put('/product/:productid', requireAuth, (req, res) => {

    const { name, description, categoryid, brand, price } = req.body;

    productDB.updateProduct(name, description, categoryid, brand, price, req.params.productid, (err, results) => {

        if (err)
            res.status(500).json({ result: "Internal Error" })


        //No error, response with productid
        else {
            if (results.affectedRows < 1)
                res.status(500).json({ message: "Nothing was updated! Product might not exist" })
            else
                res.status(201).json({ affectedRows: results.affectedRows })

        }

    })

})


//Delete Review
app.delete('/review/:reviewid', requireAuth, (req, res) => {

    reviewDB.deleteReview(req.params.reviewid, req.userid, (err, results) => {
        if (err)
            res.status(500).json({ result: "Internal Error" })

        else {
            if (results.affectedRows < 1)
                res.status(500).json({ result: "Internal Error" })
            else
                res.status(204).end();
        }
    })
})

//get all product by brand
app.get('/product/brand/:brand', (req, res) => {

    productDB.getAllProductByBrand(req.params.brand, (err, results) => {

        if (err)
            res.status(500).json({ result: "Internal Error" })

        //No error, response with product info
        else {
            res.status(200).json(results)
        }
    })

});

//get all product
app.get('/product', (req, res) => {

    productDB.getAllProduct((err, results) => {

        if (err)
            res.status(500).json({ result: "Internal Error" })

        //No error, response with product info
        else {
            res.status(200).json(results)

        }
    })
});

//login
app.post('/user/login', function (req, res) {
    var username = req.body.username;
    var password = req.body.password;

    userDB.loginUser(username, password, function (err, result, token) {
        if (!err) {

            req.session.user = {
                userid: result[0].userid,
                type: result[0].type
            };

            console.log(result[0].username + " logged in");
            
            res.status(200).json({ success: 'login successful' });

        } else {
            res.status(500);
            res.send("Error Code: " + err.statusCode);
        }
    });
});

// logout
app.post('/user/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Could not log out' });
    }
    res.clearCookie('sessionId'); // Clear session cookie
    res.status(200).json({ message: 'Logged out successfully' });
  });
});

//Api no. 1 Endpoint: POST /users/ | Add new user
app.post('/users', bcryptMiddleware.hashPassword, (req, res) => {
    var { username, email, contact, password, profile_pic_url } = req.body;

    if(!profile_pic_url){
        profile_pic_url="";
    }
    
    if (!validator.isStrongPassword(password, {
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
    })) {
        return res.status(400).json({
            message: "Password must be at least 8 characters long and include at least one number, one special character, one lowercase letter, and one uppercase letter."
        });
    } 

    userDB.addNewUser(username, email, contact, res.locals.hash, "Customer", profile_pic_url, (err, results) => {

        if (err) {

            //Check if name or email is dup"
            if (err.code == "ER_DUP_ENTRY")
                res.status(422).json({ message: `The new username OR new email provided already exists.` })

            //Otherwise unknown error
            else
                res.status(500).json({ message: "Internal Error" })

        }

        //No error, response with userid
        else
            res.status(201).json({ userid: results.insertId,username:username })

    })

})

//Api no. 2 Endpoint: GET /users/ | Get all user
app.get('/users', (req, res) => {

    userDB.getAllUser((err, results) => {

        if (err)
            res.status(500).json({ result: "Internal Error" })

        //No error, response with all user info
        else {
            res.status(200).json(results)

        }
    })

});

//Api no. 3 Endpoint: GET /users/:id/ | Get user by userid
app.get('/users/:id', (req, res) => {

    userDB.getUser(req.params.id, (err, results) => {

        if (err)
            res.status(500).json({ result: "Internal Error" })

        //No error, response with user info
        else {
            res.status(200).json(results[0])

        }
    })
});

//Api no. 4 Endpoint: PUT /users/:id/ | Update info user by userid
app.put('/users/:id', requireAuth, (req, res) => {
    const { username, email, contact, password, profile_pic_url, oldpassword } = req.body;

    userDB.updateUser(username, email, contact, password, req.type, profile_pic_url, req.userid, oldpassword, (err, results) => {

        if (err) {

            //Check if name or email is dup"
            if (err.code == "ER_DUP_ENTRY")
                res.status(422).json({ message: `The new username OR new email provided already exists.` })

            //Otherwise unknown error
            else
                res.status(500).json({ result: "Internal Error" })

        }
        else {
            console.log(results)
            if (results.affectedRows < 1)
                res.status(400).json({ message: "Incorrect Password" })
            else
                res.status(204).end();
        }

    })
})

//CATEGORY

//Api no. 5 Endpoint: POST /category | Add new category
app.post('/category', requireAuth, (req, res) => {

    const { category, description } = req.body;

    categoryDB.addNewCategory(category, description, (err, results) => {

        if (err) {

            //Check if name or email is dup
            if (err.code == "ER_DUP_ENTRY")
                res.status(422).json({ message: `The category name provided already exists` })

            //Otherwise unknown error
            else
                res.status(500).json({ result: "Internal Error" })

        }

        //No error, response with userid
        else
            res.status(204).end();

    })

})

//Api no. 6 Endpoint: GET /category | Get all category
app.get('/category', (req, res) => {

    categoryDB.getAllCategory((err, results) => {

        if (err)
            res.status(500).json({ result: "Internal Error" })

        //No error, response with all user info
        else {
            res.status(200).json(results)

        }
    })

});

//PRODUCT

//Api no. 7 Endpoint: POST /product/ | Add new product
app.post('/product', requireAdmin, (req, res) => {

    const { name, description, categoryid, brand, price } = req.body;

    productDB.addNewProduct(name, description, categoryid, brand, price, (err, results) => {

        if (err)
            res.status(500).json({ result: "Internal Error" })

        //No error, response with productid
        else
            res.status(201).json({ productid: results.insertId })

    })

})

//Api no. 8 GET /product/:id | Get product info from productid 
app.get('/product/:id', (req, res) => {

    productDB.getProduct(req.params.id, (err, results) => {

        if (err)
            res.status(500).json({ result: "Internal Error" })

        //No error, response with product info
        else {
            res.status(200).json(results)

        }
    })

});

//Api no. 9 Endpoint: DELETE /product/:id/ | Delete product from productid 
app.delete('/product/:id', requireAuth, (req, res) => {


    productDB.deleteProduct(req.params.id, (err, results) => {

        if (err)
            res.status(500).json({ result: "Internal Error" })

        else
            res.status(204).end();

    })

});

//REVIEW

//Api no. 10 Endpoint: POST /product/:id/review/ | Add review
app.post('/product/:id/review/', requireAuth, (req, res) => {

    const { userid, rating, review } = req.body;
    reviewDB.addReview(userid, rating, review, req.params.id, (err, results) => {

        if (err)
            res.status(500).json({ result: "Internal Error" })

        //No error, response with reviewid
        else
            res.status(201).json({ reviewid: results.insertId })

    })

})

//Api no. 11 Endpoint: GET /product/:id/reviews | Get all review from productid
app.get('/product/:id/reviews', (req, res) => {

    reviewDB.getProductReview(req.params.id, (err, results) => {

        if (err)
            res.status(500).json({ result: "Internal Error" })

        //No error, response with all user info
        else
            res.status(200).json(results)

    })

});
 

//BONUS REQUIREMENT DISCOUNT

//Api no. 15 Endpoint: POST /product/:id/discount | Add new discount
app.post('/discount/:productid', requireAdmin, (req, res) => {

    if (req.type.toLowerCase() != "admin") res.status(403).json({ message: 'Not authorized!' });
    if (req.type.toLowerCase() != "admin") return

    const { discount_percentage, start_at, end_at, name, description } = req.body;
    const productid = req.params.productid;
    discountDB.addNewDiscount(productid, discount_percentage, start_at, end_at, name, description, (err, results) => {

        if (err) {
            if (err.errno == 1292 && err.sqlMessage.startsWith("Incorrect datetime"))
                res.status(400).json({ message: "Invalid Time" })
            else
                res.status(500).json({ message: "Internal Error" })
        }

        else
            res.status(201).json({ discountid: results.insertId })

    })

})

//Api no. 16 Endpoint: GET /discount/ | Get all discount
app.get('/discount', (req, res) => {

    discountDB.getAllDiscount((err, results) => {

        if (err)
            res.status(500).json({ result: "Internal Error" })

        else {
            res.status(200).json(results)


        }
    })

});

//Api no. 17 Endpoint: GET /product/:id/discounts | Get user by userid
app.get('/discount/:id/', (req, res) => {

    discountDB.getProductDiscount(req.params.id, (err, results) => {

        if (err)
            res.status(500).json({ result: "Internal Error" })

        else
            res.status(200).json(results)

    })
});


//BONUS REQUIREMENT PRODUCT IMAGE

//Api no. 13 Endpoint: POST /product/:id/image  | Upload product image 
app.post('/product/:id/image', requireAuth, upload.single('image'), function (req, res) {

    //Check if there is file
    if (req.file == undefined) {
        res.status(422).json({ message: "No file given" })
    } else {
        const { filename: imageName, mimetype: imageType, path: imagePath, size: imageSize } = req.file;
        const productid = req.params.id;
        const imageExtension = imageType.split("/")[imageType.split("/").length - 1];
        const oneMegabyte = 1000000;

        //Check if file is more than 1mb
        if (imageSize > oneMegabyte) {

            //Remove file if file size too large
            fs.unlink(imagePath, (err) => { if (err) console.error(err) })

            res.status(413).json({ message: "File size too large" })

            //Check if the image type is correct
        } else if (!(imageExtension == "jpeg" || imageExtension == "png" || imageExtension == "jpg")) {

            //remove file if file type is not jpeg/png/jpg
            fs.unlink(imagePath, (err) => { if (err) console.error(err) })

            res.status(415).json({ message: "Invalid file type" })

        } else
            // Add image 
            productImagesDB.addImage(productid, imageName, imageType, imagePath.slice(7, imagePath.length), (err, results) => {

                if (err) {
                    //Remove picture if error occured when updating sql
                    fs.unlink(imagePath, (err) => { if (err) console.error(err) })
                    res.status(500).json({ result: "Internal Error" })
                }

                else
                    res.status(200).json({ affectedRows: results.affectedRows });

            })
    }

});

//Api no. 14 Endpoint: GET /product/:id/image | Get product image by productid
app.get('/product/:id/image', (req, res) => {

    productImagesDB.getProductImage(req.params.id, (err, results) => {

        if (err)
            res.status(500).json({ result: "Internal Error" })

        else
            res.status(200).json(results)

    })
});

//Api no. 20 Endpoint: GET /product/cheapest/:categoryid | Get 3 cheapest product by category
app.get('/product/cheapest/:categoryid', (req, res) => {

    productDB.get3CheapestFromCategory(req.params.categoryid, (err, results) => {

        if (err)
            res.status(500).json({ result: "Internal Error" })

        else {
            if (results.length > 0)
                res.status(200).json({
                    product: results,
                    cheapestPrice: results[0].price
                })
            else
                res.status(200).json({ message: "No product" })
        }
    })
});

app.use((req, res, next) => {
    res.status(404).send('404 Not found');
});

module.exports = app;