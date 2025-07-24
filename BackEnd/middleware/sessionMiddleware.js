const express = require('express');
const session = require('express-session');
const redis = require('redis');
const { RedisStore } = require('connect-redis');

const redisClient = redis.createClient({
    url: 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
    console.error('Redis Client Error', err);
});

redisClient.connect().catch(console.error);

const store = new RedisStore({
  client: redisClient
});


module.exports = session({
    store: store,
    secret: 'theSecret',
    resave: false,
    saveUninitialized: false,
    name: 'sessionId',
    cookie: {
        secure: false,     // false for HTTP
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24  // 24 hrs
    },
})
