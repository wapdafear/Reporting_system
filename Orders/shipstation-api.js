// shipstation-api.js
const API_KEY = '3e015458d3d54b19a67577d8b8bb6f47';
const API_SECRET = 'd8b2d9dfb6ee4a56b37ce0b63fd4d6db';
const AUTH = btoa(`${API_KEY}:${API_SECRET}`);

// For debugging
console.log("shipstation-api.js loaded successfully");

// Cache settings
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const LOCAL_STORAGE_PREFIX = 'shipstation_cache_';

// Helper function to check if cache is valid
function isLocalCacheValid(cacheKey) {
    const cacheData = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${cacheKey}`);
    if (!cacheData) return false;
    
    try {
        const { timestamp } = JSON.parse(cacheData);
        return timestamp && (Date.now() - timestamp < CACHE_DURATION);
    } catch (error) {
        console.error("Error reading cache:", error);
        return false;
    }
}

// Helper function to get cached data
function getLocalCache(cacheKey) {
    try {
        const cacheData = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${cacheKey}`);
        if (!cacheData) return null;
        
        const { data } = JSON.parse(cacheData);
        return data;
    } catch (error) {
        console.error("Error reading cache data:", error);
        return null;
    }
}

// Helper function to set cache data
function setLocalCache(cacheKey, data) {
    try {
        const cacheData = {
            timestamp: Date.now(),
            data: data
        };
        localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${cacheKey}`, JSON.stringify(cacheData));
        console.log(`Data cached with key: ${cacheKey}`);
    } catch (error) {
        console.error("Error caching data:", error);
    }
}

// Function to check if an order is from Amazon
function isAmazonOrder(shipment) {
    if (!shipment) return false;
    
    // Debug the shipment object to see all available fields
    console.log("Checking shipment:", shipment);
    
    // Check multiple fields for Amazon indicators
    // Check store name - this is usually the most reliable indicator
    const storeNameCheck = shipment.storeName && 
        (shipment.storeName.toLowerCase().includes('amazon') || 
         shipment.storeName.toLowerCase().includes('amz'));
        
    // Check order number - Amazon often has specific patterns
    const orderNumberCheck = shipment.orderNumber && 
        (shipment.orderNumber.toLowerCase().includes('amazon') || 
         shipment.orderNumber.toLowerCase().includes('amz') ||
         shipment.orderNumber.startsWith('TBA') || 
         shipment.orderNumber.startsWith('X00'));
        
    // Check customer name - sometimes Amazon fulfillment centers are listed
    const customerNameCheck = shipment.shipTo && 
        shipment.shipTo.name && 
        shipment.shipTo.name.toLowerCase().includes('amazon');
        
    // Check service code - sometimes specific to Amazon
    const serviceCheck = shipment.serviceCode && 
        shipment.serviceCode.toLowerCase().includes('amazon');
        
    // ShipStation sometimes stores marketplace info in the advancedOptions
    const advancedOptionsCheck = shipment.advancedOptions && 
        shipment.advancedOptions.storeId && 
        shipment.advancedOptions.storeId.toString().includes('amazon');
        
    // In shipstation, store ID 20 is often Amazon
    const storeIdCheck = shipment.storeId === 20 || 
        (shipment.advancedOptions && shipment.advancedOptions.storeId === 20);
    
    // Combined result
    const isAmazon = storeNameCheck || orderNumberCheck || customerNameCheck || 
                      serviceCheck || advancedOptionsCheck || storeIdCheck;
    
    // Log the result and the reasons if it's an Amazon order
    if (isAmazon) {
        console.log("✓ Identified Amazon shipment:", {
            orderNumber: shipment.orderNumber,
            storeNameMatch: storeNameCheck, 
            orderNumberMatch: orderNumberCheck,
            customerNameMatch: customerNameCheck,
            serviceMatch: serviceCheck,
            advancedOptionsMatch: advancedOptionsCheck,
            storeIdMatch: storeIdCheck
        });
    }
    
    return isAmazon;
}

async function fetchShipStationOrders(startDate, endDate) {
    console.log("Starting to fetch ShipStation orders...");
    console.log("Date range:", { startDate, endDate });
    
    // Create a cache key based on the date range
    const cacheKey = `orders_${startDate}_${endDate}`;
    
    // Check cache first
    if (isLocalCacheValid(cacheKey)) {
        console.log("Using cached orders data");
        const cachedOrders = getLocalCache(cacheKey);
        if (cachedOrders && cachedOrders.length > 0) {
            console.log(`Retrieved ${cachedOrders.length} orders from cache`);
            return cachedOrders;
        }
    }

    try {
        // Format dates for ShipStation API
        const formattedStartDate = new Date(startDate).toISOString();
        const formattedEndDate = new Date(endDate).toISOString();
        
        // Initialize variables for pagination
        let allOrders = [];
        let page = 1;
        let hasMorePages = true;
        const pageSize = 500; // Maximum page size allowed by ShipStation API
        
        // Tracking sets for parent-child relationships
        const allOrderIds = new Set();
        const allOrderNumbers = new Set(); 
        const parentIdsToFetch = new Set();
        const childIdsToFetch = new Set();
        const relatedOrderNumbersToFetch = new Set();
        
        console.log("PHASE 1: Fetching orders by date range...");
        
        // Loop through all pages until no more results
        while (hasMorePages) {
            const apiUrl = `https://ssapi.shipstation.com/orders?createDateStart=${formattedStartDate}&createDateEnd=${formattedEndDate}&pageSize=${pageSize}&page=${page}`;
            console.log(`Fetching orders page ${page}`);
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${AUTH}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                mode: 'cors'
            });

            console.log(`API response status for page ${page}: ${response.status}`);
            
            // If we get a CORS error or other error
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API error: ${response.status} ${response.statusText}`);
                console.error("Error details:", errorText);
                
                // If this is a CORS error, show a more helpful message
                if (response.status === 0 || errorText.includes("CORS") || errorText.includes("cross-origin")) {
                    console.error("This appears to be a CORS error. ShipStation API doesn't allow direct browser requests.");
                    console.error("To fix this, you need to call the API from a server or use a server-side proxy.");
                    throw new Error("CORS error: Cannot access ShipStation API directly from the browser");
                }
                
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`Received orders data for page ${page}, total count: ${data.orders?.length || 0}`);
            
            // Add orders from this page to our collection
            if (data.orders && data.orders.length > 0) {
                allOrders = [...allOrders, ...data.orders];
                
                // Track order IDs, order numbers, and identify parent-child relationships
                data.orders.forEach(order => {
                    allOrderIds.add(order.orderId);
                    allOrderNumbers.add(order.orderNumber);
                    
                    // Check for parent-child relationships
                    if (order.advancedOptions) {
                        // If this is a child order, track its parent
                        if (order.advancedOptions.parentId) {
                            parentIdsToFetch.add(order.advancedOptions.parentId);
                        }
                        
                        // If this is a parent order, track its children
                        if (order.advancedOptions.mergedIds && order.advancedOptions.mergedIds.length > 0) {
                            order.advancedOptions.mergedIds.forEach(childId => {
                                childIdsToFetch.add(childId);
                            });
                        }
                    }
                });
                
                // Check if we should fetch the next page
                if (data.orders.length < pageSize) {
                    hasMorePages = false;
                    console.log(`Page ${page} contained fewer than ${pageSize} orders, no more pages to fetch.`);
                } else {
                    page++;
                    // Add a small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } else {
                hasMorePages = false;
                console.log(`Page ${page} contained no orders, no more pages to fetch.`);
            }
        }
        
        console.log(`PHASE 1 COMPLETE: Fetched ${allOrders.length} orders from date range`);
        
        // PHASE 2: Fetch parent and child orders that may not be in the date range
        console.log("PHASE 2: Fetching related parent and child orders...");
        
        // Filter out parent and child IDs we already have
        const missingParentIds = Array.from(parentIdsToFetch).filter(id => !allOrderIds.has(id));
        const missingChildIds = Array.from(childIdsToFetch).filter(id => !allOrderIds.has(id));
        
        console.log(`Found ${missingParentIds.length} missing parent orders to fetch`);
        console.log(`Found ${missingChildIds.length} missing child orders to fetch`);
        
        // Fetch missing parent orders
        if (missingParentIds.length > 0) {
            for (const parentId of missingParentIds) {
                try {
                    const apiUrl = `https://ssapi.shipstation.com/orders/${parentId}`;
                    console.log(`Fetching parent order ID: ${parentId}`);
                    
                    const response = await fetch(apiUrl, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Basic ${AUTH}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        mode: 'cors'
                    });
                    
                    if (response.ok) {
                        const parentOrder = await response.json();
                        console.log(`Successfully fetched parent order ID: ${parentOrder.orderId}, Order #: ${parentOrder.orderNumber}`);
                        
                        // Add to our collection if we don't already have it
                        if (!allOrderIds.has(parentOrder.orderId)) {
                            allOrders.push(parentOrder);
                            allOrderIds.add(parentOrder.orderId);
                            allOrderNumbers.add(parentOrder.orderNumber);
                            
                            // Track order number as related for shipment fetching
                            relatedOrderNumbersToFetch.add(parentOrder.orderNumber);
                            
                            // Check for more child orders we might need to fetch
                            if (parentOrder.advancedOptions && 
                                parentOrder.advancedOptions.mergedIds && 
                                parentOrder.advancedOptions.mergedIds.length > 0) {
                                
                                parentOrder.advancedOptions.mergedIds.forEach(childId => {
                                    if (!allOrderIds.has(childId)) {
                                        childIdsToFetch.add(childId);
                                    }
                                });
                            }
                        }
                    } else {
                        console.error(`Failed to fetch parent order ID: ${parentId}, Status: ${response.status}`);
                    }
                    
                    // Add a small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error) {
                    console.error(`Error fetching parent order ID: ${parentId}`, error);
                }
            }
        }
        
        // Fetch missing child orders
        // Filter the list again in case we added more child IDs from parent orders
        const updatedMissingChildIds = Array.from(childIdsToFetch).filter(id => !allOrderIds.has(id));
        
        if (updatedMissingChildIds.length > 0) {
            console.log(`Fetching ${updatedMissingChildIds.length} missing child orders...`);
            
            for (const childId of updatedMissingChildIds) {
                try {
                    const apiUrl = `https://ssapi.shipstation.com/orders/${childId}`;
                    console.log(`Fetching child order ID: ${childId}`);
                    
                    const response = await fetch(apiUrl, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Basic ${AUTH}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        mode: 'cors'
                    });
                    
                    if (response.ok) {
                        const childOrder = await response.json();
                        console.log(`Successfully fetched child order ID: ${childOrder.orderId}, Order #: ${childOrder.orderNumber}`);
                        
                        // Add to our collection if we don't already have it
                        if (!allOrderIds.has(childOrder.orderId)) {
                            allOrders.push(childOrder);
                            allOrderIds.add(childOrder.orderId);
                            allOrderNumbers.add(childOrder.orderNumber);
                            
                            // Track order number as related for shipment fetching
                            relatedOrderNumbersToFetch.add(childOrder.orderNumber);
                        }
                    } else {
                        console.error(`Failed to fetch child order ID: ${childId}, Status: ${response.status}`);
                    }
                    
                    // Add a small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error) {
                    console.error(`Error fetching child order ID: ${childId}`, error);
                }
            }
        }
        
        // PHASE 3: Find orders with the same order number but no explicit parent-child relationship
        console.log("PHASE 3: Checking for implicit siblings by order number...");
        
        // Group orders by order number
        const ordersByOrderNumber = {};
        allOrders.forEach(order => {
            if (!ordersByOrderNumber[order.orderNumber]) {
                ordersByOrderNumber[order.orderNumber] = [];
            }
            ordersByOrderNumber[order.orderNumber].push(order);
        });
        
        // Find order numbers with multiple orders
        const orderNumbersWithMultipleOrders = Object.keys(ordersByOrderNumber)
            .filter(orderNumber => ordersByOrderNumber[orderNumber].length > 1);
            
        console.log(`Found ${orderNumbersWithMultipleOrders.length} order numbers with multiple orders`);
        
        // Add these to our related order numbers for shipment fetching
        orderNumbersWithMultipleOrders.forEach(orderNumber => {
            relatedOrderNumbersToFetch.add(orderNumber);
        });
        
        // Final stats
        console.log(`FETCH COMPLETE: Total ${allOrders.length} orders fetched`);
        console.log(`Found ${relatedOrderNumbersToFetch.size} related order numbers that need special shipment handling`);
        
        // Store the related order numbers as a property on the array for the shipment fetching function
        allOrders.relatedOrderNumbers = Array.from(relatedOrderNumbersToFetch);
        
        // Cache the results
        if (allOrders.length > 0) {
            setLocalCache(cacheKey, allOrders);
        }
        
        return allOrders;
    } catch (error) {
        console.error("Error fetching ShipStation orders:", error);
        // Log more details about the error
        if (error.message) console.error("Error message:", error.message);
        if (error.stack) console.error("Error stack:", error.stack);
        return [];
    }
}

async function fetchShipStationShipments(startDate, endDate) {
    console.log("Starting to fetch ShipStation shipments...");
    console.log("Date range:", { startDate, endDate });
    
    // Create a cache key based on the date range
    const cacheKey = `shipments_${startDate}_${endDate}`;
    
    // Check cache first
    if (isLocalCacheValid(cacheKey)) {
        console.log("Using cached shipments data");
        const cachedShipments = getLocalCache(cacheKey);
        if (cachedShipments && cachedShipments.length > 0) {
            console.log(`Retrieved ${cachedShipments.length} shipments from cache`);
            return cachedShipments;
        }
    }

    try {
        // Format dates for ShipStation API
        const formattedStartDate = new Date(startDate).toISOString();
        const formattedEndDate = new Date(endDate).toISOString();
        
        // Initialize variables for pagination
        let allShipments = [];
        let page = 1;
        let hasMorePages = true;
        const pageSize = 500; // Maximum page size allowed by ShipStation API
        
        // Loop through all pages until no more results
        while (hasMorePages) {
            // Include shipmentItems parameter to get detailed item information for each shipment
            const apiUrl = `https://ssapi.shipstation.com/shipments?shipDateStart=${formattedStartDate}&shipDateEnd=${formattedEndDate}&pageSize=${pageSize}&page=${page}&includeShipmentItems=true`;
            console.log(`Fetching shipments page ${page}`);
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${AUTH}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                mode: 'cors'
            });

            console.log(`API response status for page ${page}: ${response.status}`);
            
            // If we get a CORS error or other error
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API error: ${response.status} ${response.statusText}`);
                console.error("Error details:", errorText);
                
                // If this is a CORS error, show a more helpful message
                if (response.status === 0 || errorText.includes("CORS") || errorText.includes("cross-origin")) {
                    console.error("This appears to be a CORS error. ShipStation API doesn't allow direct browser requests.");
                    console.error("To fix this, you need to call the API from a server or use a server-side proxy.");
                    throw new Error("CORS error: Cannot access ShipStation API directly from the browser");
                }
                
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`Received shipments data for page ${page}, total count: ${data.shipments?.length || 0}`);
            
            // Add shipments from this page to our collection
            if (data.shipments && data.shipments.length > 0) {
                // Process each shipment to enhance with item details
                const enhancedShipments = await Promise.all(data.shipments.map(async shipment => {
                    // If this shipment has no items info, try to fetch them separately
                    if (!shipment.shipmentItems || shipment.shipmentItems.length === 0) {
                        try {
                            // Get the detailed shipment which should include items
                            const detailUrl = `https://ssapi.shipstation.com/shipments/${shipment.shipmentId}?includeShipmentItems=true`;
                            const detailResponse = await fetch(detailUrl, {
                                method: 'GET',
                                headers: {
                                    'Authorization': `Basic ${AUTH}`,
                                    'Content-Type': 'application/json'
                                }
                            });

                            if (detailResponse.ok) {
                                const detailData = await detailResponse.json();
                                if (detailData.shipmentItems && detailData.shipmentItems.length > 0) {
                                    shipment.shipmentItems = detailData.shipmentItems;
                                    console.log(`Added ${detailData.shipmentItems.length} items to shipment ${shipment.shipmentId}`);
                                }
                            }
                        } catch (itemError) {
                            console.warn(`Couldn't fetch item details for shipment ${shipment.shipmentId}:`, itemError);
                        }
                    }
                    return shipment;
                }));

                allShipments = [...allShipments, ...enhancedShipments];
                
                // Check if we should fetch the next page
                if (data.shipments.length < pageSize) {
                    hasMorePages = false;
                    console.log(`Page ${page} contained fewer than ${pageSize} shipments, no more pages to fetch.`);
                } else {
                    page++;
                    // Add a small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } else {
                hasMorePages = false;
                console.log(`Page ${page} contained no shipments, no more pages to fetch.`);
            }
        }
        
        console.log(`Successfully fetched ${allShipments.length} shipments across ${page} page(s)`);
        
        // Cache the results
        if (allShipments.length > 0) {
            setLocalCache(cacheKey, allShipments);
        }
        
        return allShipments;
    } catch (error) {
        console.error("Error fetching ShipStation shipments:", error);
        // Log more details about the error
        if (error.message) console.error("Error message:", error.message);
        if (error.stack) console.error("Error stack:", error.stack);
        return [];
    }
}

// Function to get label cost for an order
async function getLabelCost(orderNumber, shipments = null) {
    try {
        // If shipments are provided, use them instead of making an API call
        if (shipments && Array.isArray(shipments)) {
            // Find ALL matching shipments for this order number
            const orderShipments = shipments.filter(s => s.orderNumber === orderNumber);
            
            if (orderShipments.length === 0) return 0;
            
            // For orders with multiple shipments, sum all shipment costs
            if (orderShipments.length > 1) {
                console.log(`Multi-label order detected: ${orderNumber} has ${orderShipments.length} shipments`);
                let totalCost = 0;
                
                // Loop through all shipments and sum the costs
                orderShipments.forEach((shipment, index) => {
                    const shipmentCost = shipment.shipmentCost || shipment.cost || 0;
                    const cost = typeof shipmentCost === 'string' ? parseFloat(shipmentCost) || 0 : (shipmentCost || 0);
                    totalCost += cost;
                    console.log(`Shipment ${index+1} for ${orderNumber}: Cost = $${cost.toFixed(2)}`);
                });
                
                console.log(`Total label cost for order ${orderNumber}: $${totalCost.toFixed(2)}`);
                return totalCost;
            }
            
            // For single shipment orders
            const shipment = orderShipments[0];
            const cost = shipment.shipmentCost || shipment.cost || 0;
            
            // Parse the cost if it's a string
            return typeof cost === 'string' ? parseFloat(cost) || 0 : (cost || 0);
        }

        // Fallback to individual API call if no shipments provided
        const apiUrl = `https://ssapi.shipstation.com/shipments?orderNumber=${orderNumber}`;
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${AUTH}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors'
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (data.shipments && data.shipments.length > 0) {
            // Sum costs of all shipments for this order
            let totalCost = 0;
            data.shipments.forEach((shipment, index) => {
                const cost = shipment.shipmentCost || 0;
                totalCost += parseFloat(cost) || 0;
                console.log(`API Shipment ${index+1} for ${orderNumber}: Cost = $${cost}`);
            });
            console.log(`Total API label cost for order ${orderNumber}: $${totalCost.toFixed(2)}`);
            return totalCost;
        }
        return 0;
    } catch (error) {
        console.error(`Error fetching label cost for order ${orderNumber}:`, error);
        return 0;
    }
}

// Export functions for use in other files
export { fetchShipStationOrders, fetchShipStationShipments, isAmazonOrder, getLabelCost };