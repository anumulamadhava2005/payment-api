const express = require('express');
const Razorpay = require('razorpay');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const cors = require('cors');  // ✅ Added CORS
require('dotenv').config();  // ✅ Load environment variables
const { validateWebhookSignature } = require('razorpay/dist/utils/razorpay-utils');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,  // ✅ Use .env
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Function to read/write orders.json
const readData = () => fs.existsSync('orders.json') ? JSON.parse(fs.readFileSync('orders.json')) : [];
const writeData = (data) => fs.writeFileSync('orders.json', JSON.stringify(data, null, 2));
if (!fs.existsSync('orders.json')) writeData([]);

// ✅ Create Order API
app.post('/createOrder', async (req, res) => {
    try {
        const { amount, currency, receipt, notes } = req.body;

        const options = {
            amount: amount * 100,
            currency,
            receipt,
            notes,
        };

        const order = await razorpay.orders.create(options);
        const orders = readData();
        orders.push({ order_id: order.id, amount: order.amount, currency: order.currency, receipt: order.receipt, status: 'created' });
        writeData(orders);

        res.json(order);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// ✅ Verify Payment API (Fixed Signature Check)
app.post('/verifyPayment', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    try {
        const isValidSignature = validateWebhookSignature(body, razorpay_signature, secret);
        
        if (isValidSignature) {  // ✅ Corrected logic
            const orders = readData();
            const order = orders.find(o => o.order_id === razorpay_order_id);
            if (order) {
                order.status = 'paid';
                order.payment_id = razorpay_payment_id;
                writeData(orders);
            }
            console.log('✅ Payment verified successfully');
            res.status(200).json({ status: 'ok' });
        } else {
            console.log('❌ Invalid signature');
            res.status(400).json({ error: 'Invalid signature' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
});

// ✅ Success Page Route
app.get('/payment-success', (req, res) => {
    res.sendFile(path.join(__dirname, 'success.html'));
});

// ✅ Start Server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
