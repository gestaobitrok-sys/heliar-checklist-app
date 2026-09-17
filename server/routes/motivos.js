const express = require('express');
const { MOTIVOS } = require('../motivos');

const router = express.Router();
router.get('/', (req, res) => res.json(MOTIVOS));

module.exports = router;
