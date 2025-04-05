import { product } from './Net32-stock.js';

// API endpoints and data handling
class BrandsAPI {
    constructor() {
        this.baseUrl = 'https://backend-api-4679.onrender.com/api';
        this.cachedProducts = null;
        this.cachedApiProducts = null; // New cache for direct API products
        
        // Local manufacturer database for fallback
        this.localManufacturers = {
            "B9909-10": "McKesson",
            "01-C0700": "Septodont",
            "01S0530": "Septodont",
            "A0140": "3M ESPE",
            "A0141": "3M ESPE",
            "A0150": "Dentsply",
            "A0151": "Dentsply",
            "A0152": "Dentsply",
            "A0160": "Kerr",
            "A0161": "Kerr",
            "A0162": "Kerr",
            "A0170": "GC America",
            "A0171": "GC America",
            "A0180": "Ivoclar Vivadent",
            "A0181": "Ivoclar Vivadent",
            "A0190": "Ultradent",
            "A0191": "Ultradent",
            "A0200": "Coltene",
            "A0201": "Coltene",
            "A0210": "Premier Dental",
            "A0211": "Premier Dental",
            "A0220": "Hu-Friedy",
            "A0221": "Hu-Friedy",
            "A0230": "Henry Schein",
            "A0231": "Henry Schein",
            "A0240": "Patterson Dental",
            "A0241": "Patterson Dental",
            "A0250": "Crosstex",
            "A0251": "Crosstex"
        };
    }

    // Get raw API products without Net32 merging (for ShipStation page)
    async fetchAPIProducts() {
        try {
            // If we have cached API products, return them
            if (this.cachedApiProducts && this.cachedApiProducts.length > 0) {
                console.log('Using cached direct API products, length:', this.cachedApiProducts.length);
                return this.cachedApiProducts;
            }
            
            console.log('Fetching raw products directly from API (without Net32 merging)');
            
            const response = await fetch(`${this.baseUrl}/products`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 5000 // Add a timeout to fail faster
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const apiProducts = await response.json();
            console.log('Direct API Products received:', apiProducts.length);
            
            // Cache these for later
            this.cachedApiProducts = apiProducts;
            
            return apiProducts;
        } catch (error) {
            console.warn('Error fetching direct API products:', error.message);
            return [];
        }
    }

    // Original function with Net32 merging (for Stock Management page)
    async fetchProducts() {
        try {
            // If we already have cached products, return them
            if (this.cachedProducts && this.cachedProducts.length > 0) {
                console.log('Using cached products data, length:', this.cachedProducts.length);
                return this.cachedProducts;
            }
            
            // Log the attempt
            console.log('Attempting to fetch products from:', `${this.baseUrl}/products`);

            const response = await fetch(`${this.baseUrl}/products`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 5000 // Add a timeout to fail faster
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const apiProducts = await response.json();
            console.log('API Products received:', apiProducts.length);
            
            if (apiProducts.length > 0) {
                console.log('Sample API product:', apiProducts[0]);
            }
            
            // Map local products with API data
            const mappedProducts = product.map(item => {
                // The local product has vp_code, but API uses Sku
                const localSku = String(item.vp_code || '');
                
                // Find matching product from API data
                const apiProduct = apiProducts.find(p => 
                    p.Sku && String(p.Sku).toLowerCase() === localSku.toLowerCase()
                );
                
                if (apiProduct) {
                    console.log('Found match for:', localSku, 'with Manufacturer:', apiProduct.Manufacturer);
                    return {
                        sku: localSku, // Use the local SKU for consistency
                        description: item.description || '',
                        stockLevel: item.old_count || 0,
                        manufacturer: apiProduct.Manufacturer,
                        cost_price: apiProduct && apiProduct.Cost !== undefined ? Number(apiProduct.Cost) : 0
                    };
                } else {
                    // If not found in API, check our local fallback database
                    const manufacturer = this.getManufacturerFromLocal(localSku);
                    return {
                        sku: localSku,
                        description: item.description || '',
                        stockLevel: item.old_count || 0,
                        manufacturer: manufacturer,
                        cost_price: 0
                    };
                }
            });
            
            // Cache the products for later use
            this.cachedProducts = mappedProducts;
            
            return mappedProducts;

        } catch (error) {
            console.warn('Error fetching products from API:', error.message);
            console.log('Falling back to local product data with manufacturer mappings');
            return this.getProductsWithLocalManufacturers();
        }
    }

    // Get manufacturer from local database for a given SKU
    getManufacturerFromLocal(sku) {
        // Check for exact match
        if (this.localManufacturers[sku]) {
            return this.localManufacturers[sku];
        }
        
        // Check for partial match (starts with)
        for (const [knownSku, manufacturer] of Object.entries(this.localManufacturers)) {
            if (sku.startsWith(knownSku.substring(0, 3))) {
                return manufacturer;
            }
        }
        
        return 'Unknown';
    }

    // Fallback function with local manufacturer database
    getProductsWithLocalManufacturers() {
        console.log('Using fallback product data with local manufacturer mappings');
        const mappedProducts = product.map(item => {
            const sku = String(item.vp_code || '');
            const manufacturer = this.getManufacturerFromLocal(sku);
            
            return {
                sku: sku,
                description: item.description || '',
                stockLevel: item.old_count || 0,
                manufacturer: manufacturer,
                cost_price: 0
            };
        });
        
        // Cache this data too
        this.cachedProducts = mappedProducts;
        
        return mappedProducts;
    }

    // For testing - log the current base URL
    logApiUrl() {
        console.log('Current API URL:', this.baseUrl);
    }

    // Update manufacturer for a product
    async updateManufacturer(sku, newManufacturer) {
        try {
            const response = await fetch(`${this.baseUrl}/products/${sku}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    Manufacturer: newManufacturer
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const updatedProduct = await response.json();
            
            // Update local cache
            if (this.cachedProducts) {
                const product = this.cachedProducts.find(p => p.sku === sku);
                if (product) {
                    product.manufacturer = newManufacturer;
                }
            }
            
            return updatedProduct;
        } catch (error) {
            console.error('Error updating manufacturer:', error);
            
            // Update local cache anyway
            if (this.cachedProducts) {
                const product = this.cachedProducts.find(p => p.sku === sku);
                if (product) {
                    product.manufacturer = newManufacturer;
                }
            }
            
            return { success: false, error: error.message };
        }
    }

    // Update cost for a product
    async updateCost(sku, newCost) {
        try {
            const response = await fetch(`${this.baseUrl}/products/${sku}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    Cost: Number(newCost)
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const updatedProduct = await response.json();
            
            // Update local cache
            if (this.cachedProducts) {
                const product = this.cachedProducts.find(p => p.sku === sku);
                if (product) {
                    product.cost_price = Number(newCost);
                }
            }
            
            return updatedProduct;
        } catch (error) {
            console.error('Error updating cost:', error);
            
            // Update local cache anyway
            if (this.cachedProducts) {
                const product = this.cachedProducts.find(p => p.sku === sku);
                if (product) {
                    product.cost_price = Number(newCost);
                }
            }
            
            return { success: false, error: error.message };
        }
    }
}

export const brandsAPI = new BrandsAPI();

// Log the API URL on initialization
brandsAPI.logApiUrl(); 