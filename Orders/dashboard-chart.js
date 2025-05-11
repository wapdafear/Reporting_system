// dashboard-chart.js - Chart utilities for Amazon Sales Dashboard

// Initialize charts
let weeklyChart = null;
let trendChart = null;
let salesPieChart = null;

// Color palette for charts
const chartColors = {
    blue: 'rgba(59, 130, 246, 0.7)',
    blueBorder: 'rgb(59, 130, 246)',
    green: 'rgba(16, 185, 129, 0.7)',
    greenBorder: 'rgb(16, 185, 129)',
    teal: 'rgba(20, 184, 166, 0.7)',
    tealBorder: 'rgb(20, 184, 166)',
    cyan: 'rgba(6, 182, 212, 0.7)',
    cyanBorder: 'rgb(6, 182, 212)',
    purple: 'rgba(124, 58, 237, 0.7)',
    purpleBorder: 'rgb(124, 58, 237)',
    pink: 'rgba(236, 72, 153, 0.7)',
    pinkBorder: 'rgb(236, 72, 153)'
};

// Pie chart colors
const pieColors = [
    'rgba(59, 130, 246, 0.7)',
    'rgba(16, 185, 129, 0.7)',
    'rgba(20, 184, 166, 0.7)',
    'rgba(6, 182, 212, 0.7)',
    'rgba(124, 58, 237, 0.7)',
    'rgba(236, 72, 153, 0.7)',
    'rgba(244, 114, 182, 0.7)',
    'rgba(248, 113, 113, 0.7)',
    'rgba(251, 146, 60, 0.7)',
    'rgba(217, 119, 6, 0.7)',
    'rgba(234, 179, 8, 0.7)'
];

// Clean up any existing charts
function destroyCharts() {
    if (weeklyChart) {
        weeklyChart.destroy();
        weeklyChart = null;
    }
    
    if (trendChart) {
        trendChart.destroy();
        trendChart = null;
    }
    
    if (salesPieChart) {
        salesPieChart.destroy();
        salesPieChart = null;
    }
}

// Create a bar chart for weekly sales
function createWeeklySalesChart(canvasId, weeklySales, weekLabels = null) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Destroy existing chart if it exists
    if (weeklyChart) {
        weeklyChart.destroy();
        weeklyChart = null;
    }
    
    // Use provided labels or generate generic ones
    const labels = weekLabels || weeklySales.map((_, i) => `Week ${i + 1}`);
    
    // Shorten labels for better display in charts
    const shortLabels = labels.map(label => {
        if (typeof label === 'string' && label.includes(':')) {
            return label.split(':')[0]; // Just use "Week X" part
        }
        return label;
    });
    
    weeklyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: shortLabels,
            datasets: [{
                label: 'Weekly Sales',
                data: weeklySales,
                backgroundColor: chartColors.blue,
                borderColor: chartColors.blueBorder,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Quantity'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Week'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: true,
                    text: 'Weekly Sales Distribution'
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            // Show full label with date range in tooltip
                            const index = context[0].dataIndex;
                            return labels[index];
                        },
                        label: function(context) {
                            return `Sales: ${context.raw}`;
                        }
                    }
                }
            }
        }
    });
    
    return weeklyChart;
}

// Create a line chart for sales trends
function createSalesTrendChart(canvasId, weeklySales, weekLabels = null) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Destroy existing chart if it exists
    if (trendChart) {
        trendChart.destroy();
        trendChart = null;
    }
    
    // Use provided labels or generate generic ones
    const labels = weekLabels || weeklySales.map((_, i) => `Week ${i + 1}`);
    
    // Shorten labels for better display in charts
    const shortLabels = labels.map(label => {
        if (typeof label === 'string' && label.includes(':')) {
            return label.split(':')[0]; // Just use "Week X" part
        }
        return label;
    });
    
    // Calculate moving average for smoother trend visualization
    const movingAvg = calculateMovingAverage(weeklySales, 2);
    
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: shortLabels,
            datasets: [
                {
                    label: 'Actual Sales',
                    data: weeklySales,
                    fill: false,
                    borderColor: chartColors.tealBorder,
                    backgroundColor: chartColors.teal,
                    tension: 0.1,
                    pointBackgroundColor: chartColors.tealBorder,
                    pointRadius: 5,
                    pointHoverRadius: 7
                },
                {
                    label: 'Trend',
                    data: movingAvg,
                    fill: false,
                    borderColor: chartColors.pinkBorder,
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    tension: 0.4,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Quantity'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Week'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: true,
                    text: 'Sales Trend Analysis'
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            // Show full label with date range in tooltip
                            const index = context[0].dataIndex;
                            return labels[index];
                        }
                    }
                }
            }
        }
    });
    
    return trendChart;
}

// Create a pie chart for sales comparison
function createSalesPieChart(canvasId, skuData, allSkus) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Destroy existing chart if it exists
    if (salesPieChart) {
        salesPieChart.destroy();
        salesPieChart = null;
    }
    
    // Get the current SKU and the top 4 other SKUs by sales
    const otherTopSkus = allSkus
        .filter(item => item.sku !== skuData.sku)
        .sort((a, b) => b.total - a.total)
        .slice(0, 4);
    
    // Combine current SKU and top others
    const chartData = [
        skuData,
        ...otherTopSkus
    ];
    
    // Calculate total for "Others" if needed
    const totalOthers = allSkus
        .filter(item => !chartData.find(d => d.sku === item.sku))
        .reduce((sum, item) => sum + item.total, 0);
    
    const labels = chartData.map(item => item.sku);
    const data = chartData.map(item => item.total);
    
    // Add "Others" if there are more SKUs
    if (totalOthers > 0) {
        labels.push('Others');
        data.push(totalOthers);
    }
    
    salesPieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: pieColors.slice(0, labels.length),
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                },
                title: {
                    display: true,
                    text: 'Market Share Comparison'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${context.label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    return salesPieChart;
}

// Helper function to calculate moving average
function calculateMovingAverage(data, windowSize) {
    // If we don't have enough data, return the original
    if (data.length <= windowSize) {
        return [...data];
    }
    
    const result = [];
    
    // Handle the beginning (less than window size)
    for (let i = 0; i < windowSize; i++) {
        const subArray = data.slice(0, i + 1);
        const avg = subArray.reduce((sum, val) => sum + val, 0) / subArray.length;
        result.push(avg);
    }
    
    // Calculate moving average for the rest
    for (let i = windowSize; i < data.length; i++) {
        const subArray = data.slice(i - windowSize, i + 1);
        const avg = subArray.reduce((sum, val) => sum + val, 0) / subArray.length;
        result.push(avg);
    }
    
    return result;
}

// Calculate growth metrics
function calculateGrowthMetrics(weeklySales) {
    // Find best week and peak sales
    let bestWeekIndex = 0;
    let peakSales = 0;
    
    for (let i = 0; i < weeklySales.length; i++) {
        if (weeklySales[i] > peakSales) {
            peakSales = weeklySales[i];
            bestWeekIndex = i;
        }
    }
    
    // Average weekly sales
    const avgWeeklySales = weeklySales.reduce((sum, val) => sum + val, 0) / weeklySales.length;
    
    // Calculate growth rate (week 1 to last week with data)
    let growthRate = 0;
    let lastWeekWithData = weeklySales.length - 1;
    
    // Find last week with actual data (not zero)
    while (lastWeekWithData > 0 && weeklySales[lastWeekWithData] === 0) {
        lastWeekWithData--;
    }
    
    // Calculate growth if we have data
    if (lastWeekWithData > 0 && weeklySales[0] > 0) {
        growthRate = ((weeklySales[lastWeekWithData] - weeklySales[0]) / weeklySales[0]) * 100;
    }
    
    return {
        avgWeeklySales,
        growthRate,
        bestWeekIndex,
        peakSales
    };
}

// Export functions
export {
    destroyCharts,
    createWeeklySalesChart,
    createSalesTrendChart,
    createSalesPieChart,
    calculateGrowthMetrics
}; 