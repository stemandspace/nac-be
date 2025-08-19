
module.exports = {
    routes: [
        {
            method: 'POST',
            path: '/v1/save-draft-and-create-order',
            handler: 'v1.saveDraftAndCreateOrder',
        },
        {
            method: 'POST',
            path: '/v1/verify-payment-and-publish',
            handler: 'v1.verifyPaymentAndPublish',
        },
        {
            method: 'POST',
            path: '/v1/webhook',
            handler: 'v1.webhookHandler',
        }
    ]
}