const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const adminLayout = '../views/layouts/admin';

router.get('', async (req, res) => {
  isLoggedIn = req.session.isLoggedIn || false;
  console.log("OutPut: " + isLoggedIn);
  try {
    const locals = {
      title: "NodeJs Blog",
      description: "Simple Blog created with NodeJs, Express & MongoDb.",
      loggedIn: isLoggedIn,
    }

    let perPage = 10;
    let page = req.query.page || 1;

    const data = await Post.aggregate([ { $sort: { createdAt: -1 } } ])
    .skip(perPage * page - perPage)
    .limit(perPage)
    .exec();

    const count = await Post.count();
    const nextPage = parseInt(page) + 1;
    const hasNextPage = nextPage <= Math.ceil(count / perPage);

    res.render('index', { 
      locals,
      data,
      current: page,
      nextPage: hasNextPage ? nextPage : null,
      currentRoute: '/'
    });
  } catch (error) {
    console.log(error);
  }
});

router.get('/login', (req, res) => {
  res.render('login', {
    currentRoute: '/login'
  });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username: username });

    if (user && bcrypt.compareSync(password, user.password)) {
        req.session.user = {
            id: user._id,
            username: user.username
        };
        req.session.isLoggedIn = true;
        res.redirect('/profile');
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

router.get('/register', (req, res) => {
  const locals = {
    currentRoute: '/register'
  };
  res.render('register', locals);
});

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const user = await User.create({ username, password: hashedPassword });
      req.session.user = {
        id: user._id,
        username: user.username,
      };
      req.session.isLoggedIn = true;
      res.redirect('/profile');
    } catch (error) {
      console.error(error);
      if (error.code === 11000) {
        res.status(409).json({ message: 'User already in use' });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/post/:id', async (req, res) => {
  try {
    let slug = req.params.id;

    const data = await Post.findById({ _id: slug });

    const locals = {
      title: data.title,
      description: "Simple Blog created with NodeJs, Express & MongoDb.",
    }

    res.render('post', { 
      locals,
      data,
      currentRoute: `/post/${slug}`
    });
  } catch (error) {
    console.log(error);
  }

});

router.post('/search', async (req, res) => {
  try {
    const locals = {
      title: "Search",
      description: "Simple Blog created with NodeJs, Express & MongoDb.",
      loggedIn: req.session.isLoggedIn || false
    }

    let searchTerm = req.body.searchTerm;
    const searchNoSpecialChar = searchTerm.replace(/[^a-zA-Z0-9 ]/g, "")

    const data = await Post.find({
      $or: [
        { title: { $regex: new RegExp(searchNoSpecialChar, 'i') }},
        { body: { $regex: new RegExp(searchNoSpecialChar, 'i') }}
      ]
    });

    res.render("search", {
      data,
      locals,
      currentRoute: '/'
    });

  } catch (error) {
    console.log(error);
  }

});

router.get('/about', (req, res) => {
  res.render('about', {
    currentRoute: '/about',
    loggedIn: req.session.isLoggedIn || false
  });
});

router.get('/profile', async (req, res) => {
  const currentUser = req.session.user;

  if (currentUser) {
    const user = {
      username: currentUser.username,
      role: currentUser.role,
    };
    const userPosts = await Post.find({ userId: currentUser.id }).exec();

    res.render('profile', { user: user, userPosts, currentRoute: '/profile', loggedIn: req.session.isLoggedIn || false});
  } else {
    res.redirect('/login');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      res.status(500).send('Internal Server Error');
    } else {
      res.clearCookie('connect.sid');
      res.redirect('/');
    }
  });
});

router.get('/add-post', async (req, res) => {
  const locals = {
    title: 'Add Post',
    description: 'Simple Blog created with NodeJs, Express & MongoDb.'
  };
  res.render('add-post', { locals, layout: adminLayout });
});

router.post('/add-post', async (req, res) => {
  const { title, body } = req.body;
  try {
    if (!title || !body) {
      return res.status(400).send('Title and body are required.');
    }

    const newPost = new Post({
      title: title,
      body: body,
      userId: req.session.user.id,
    });

    await newPost.save();

    res.redirect('/profile');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/edit-post/:id', async (req, res) => {
  try {
    const locals = {
      title: "Edit Post",
      description: "Free NodeJs User Management System",
    };
    const data = await Post.findOne({ _id: req.params.id });

    res.render('edit-post', {
      locals,
      data,
      layout: adminLayout
    })
  } catch (error) {
    console.log(error);
  }
});

router.put('/edit-post/:id', async (req, res) => {
  try {
    await Post.findByIdAndUpdate(req.params.id, {
      title: req.body.title,
      body: req.body.body,
      updatedAt: Date.now()
    });
    res.redirect(`/profile`);
  } catch (error) {
    console.log(error);
  }
});

router.delete('/delete-post/:id', async (req, res) => {
  try {
    await Post.deleteOne( { _id: req.params.id } );
    res.redirect('/profile');
  } catch (error) {
    console.log(error);
  }
});

module.exports = router;