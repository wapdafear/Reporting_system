const API_KEY = '3e015458d3d54b19a67577d8b8bb6f47'; // Replace with your ShipStation API Key
const API_SECRET = 'd8b2d9dfb6ee4a56b37ce0b63fd4d6db'; // Replace with your ShipStation API Secret
const AUTH = btoa(`${API_KEY}:${API_SECRET}`);
async function fetchShipStationShipments() {

    try {
        const response = await fetch(`https://ssapi.shipstation.com/shipments?orderNumber=113-8233331-0279463`, {
            headers: {
                'Authorization': `Basic ${AUTH}`,
                'Content-Type': 'application/json'
            }
        });
        console.log( await response.json());
    } catch (error) {
        console.log(error);
    }
}
fetchShipStationShipments();