document.addEventListener('DOMContentLoaded', () => {
    // === Sidebar Toggle Logic ===
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const toggleIcon = document.getElementById('toggle-icon');
    
    // Check local storage for sidebar state
    const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    if (isCollapsed && sidebar) {
        sidebar.classList.add('collapsed');
        if(toggleIcon) toggleIcon.style.transform = 'rotate(180deg)';
    }

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            const collapsedNow = sidebar.classList.contains('collapsed');
            localStorage.setItem('sidebar-collapsed', collapsedNow);
            if(toggleIcon) {
                toggleIcon.style.transform = collapsedNow ? 'rotate(180deg)' : 'rotate(0deg)';
            }
            
            // Resize charts if they exist so they fit the new container width
            setTimeout(() => {
                if (window.revenueChart) window.revenueChart.resize();
                if (window.rentalsChart) window.rentalsChart.resize();
                if (window.fleetChart) window.fleetChart.resize();
            }, 300); // Wait for CSS transition
        });
    }

    // === Chart.js & Dashboard Dynamics ===
    if (document.getElementById('revenueChart')) {
        initDashboard();
    }

    async function initDashboard() {
        if (!window.supabaseClient) {
            console.error("Supabase client not loaded.");
            return;
        }

        try {
            // Fetch Data
            const { data: bookings } = await supabaseClient.from('bookings').select('*').order('created_at', { ascending: false });
            const { data: vehicles } = await supabaseClient.from('vehicles').select('*');

            // Create vehicle map for image lookup
            const vehicleMap = {};
            if (vehicles) {
                vehicles.forEach(v => {
                    vehicleMap[v.name] = { url: v.image_url, emoji: v.image_emoji };
                });
            }

            // 1. Calculate Metrics
            let totalRevenue = 0;
            let recentBookingsHtml = '';
            
            if (bookings) {
                bookings.forEach((b, index) => {
                    if (b.status !== 'Cancelled') totalRevenue += b.total_amount;
                    
                    // Render up to 5 recent bookings
                    if (index < 5) {
                        let statusColor = b.status === 'Completed' ? 'green-500/10 text-green-400' : 
                                          b.status === 'Active' ? 'accent-blue/10 text-accent-blue' : 
                                          b.status === 'Cancelled' ? 'red-500/10 text-red-400' : 'yellow-500/10 text-yellow-400';
                        
                        let vData = vehicleMap[b.vehicle_name] || {};
                        let imageDisplay = vData.url 
                            ? `<img src="${vData.url}" alt="${b.vehicle_name}" class="w-10 h-10 rounded-lg object-cover">`
                            : `<div class="w-10 h-10 rounded-lg bg-[#252833] flex items-center justify-center text-xl">${vData.emoji || '🚘'}</div>`;

                        recentBookingsHtml += `
                            <tr class="hover:bg-white/5 transition-colors">
                              <td class="px-6 py-4 flex items-center gap-3">
                                ${imageDisplay}
                                <div>
                                  <p class="text-sm font-semibold">${b.vehicle_name}</p>
                                  <p class="text-xs text-text-muted">${b.customer_name}</p>
                                </div>
                              </td>
                              <td class="px-6 py-4 text-sm">${b.start_date}</td>
                              <td class="px-6 py-4"><span class="px-2 py-1 bg-${statusColor} text-xs rounded-full font-medium border border-current">${b.status}</span></td>
                            </tr>
                        `;
                    }
                });
                document.getElementById('recent-bookings-body').innerHTML = recentBookingsHtml || '<tr><td colspan="3" class="text-center py-4">No recent bookings</td></tr>';
            }

            // Format Revenue
            document.getElementById('total-revenue-text').textContent = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalRevenue);

            // Compute Fleet Stats
            let categoryCounts = { 'SUV': 0, 'MPV': 0, 'Luxury': 0, 'Luxury MPV': 0 };
            let activeRentalsCount = 0;
            
            let statusByCategory = {
                'SUV': { available: 0, rented: 0 },
                'MPV': { available: 0, rented: 0 },
                'Luxury': { available: 0, rented: 0 },
                'Luxury MPV': { available: 0, rented: 0 }
            };

            if (vehicles) {
                vehicles.forEach(v => {
                    let cat = v.category;
                    if (!categoryCounts[cat]) {
                        categoryCounts[cat] = 0;
                        statusByCategory[cat] = { available: 0, rented: 0 };
                    }
                    categoryCounts[cat]++;
                    
                    if (v.status === 'On Rent') {
                        activeRentalsCount++;
                        statusByCategory[cat].rented++;
                    } else if (v.status === 'Available') {
                        statusByCategory[cat].available++;
                    }
                });
            }

            document.getElementById('total-vehicles-text').textContent = activeRentalsCount;
            
            // Update Breakdown UI
            document.getElementById('count-suv').textContent = categoryCounts['SUV'] || 0;
            // Map Sedan UI to MPV
            let sedanLabel = document.getElementById('count-sedan').previousElementSibling.querySelector('span:nth-child(2)');
            if (sedanLabel) sedanLabel.textContent = 'MPV';
            document.getElementById('count-sedan').textContent = categoryCounts['MPV'] || 0;
            document.getElementById('count-luxury').textContent = categoryCounts['Luxury'] || 0;

            // === Init Chart.js ===
            Chart.defaults.color = '#8b949e';
            Chart.defaults.font.family = "'Inter', sans-serif";

            // 1. Revenue Chart (Line) - Mocking a time series based on total
            const revCtx = document.getElementById('revenueChart');
            if (revCtx) {
                const gradient = revCtx.getContext('2d').createLinearGradient(0, 0, 0, 400);
                gradient.addColorStop(0, 'rgba(0, 149, 255, 0.5)');
                gradient.addColorStop(1, 'rgba(0, 149, 255, 0)');

                // Create some trend points that sum up roughly to our total trend
                let base = totalRevenue / 7;
                window.revenueChart = new Chart(revCtx, {
                    type: 'line',
                    data: {
                        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                        datasets: [{
                            label: 'Revenue (Rp)',
                            data: [base*0.5, base*0.8, base*1.2, base*0.9, base*1.5, base*2.0, base*1.8],
                            borderColor: '#0095ff',
                            backgroundColor: gradient,
                            borderWidth: 3,
                            tension: 0.4,
                            fill: true,
                            pointBackgroundColor: '#0095ff',
                            pointBorderColor: '#161b22',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false }, tooltip: { displayColors: false } },
                        scales: { x: { grid: { display: false } }, y: { display: false } }
                    }
                });
            }

            // 2. Active Rentals (Doughnut)
            const rentCtx = document.getElementById('rentalsChart');
            if (rentCtx) {
                window.rentalsChart = new Chart(rentCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['SUV', 'MPV', 'Luxury', 'Luxury MPV'],
                        datasets: [{
                            data: [
                                statusByCategory['SUV']?.rented || 0, 
                                statusByCategory['MPV']?.rented || 0, 
                                statusByCategory['Luxury']?.rented || 0, 
                                statusByCategory['Luxury MPV']?.rented || 0
                            ],
                            backgroundColor: ['#2563eb', '#22d3ee', '#1e40af', '#94a3b8'],
                            borderWidth: 0,
                            hoverOffset: 4
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }
                });
            }

            // 3. Fleet Status By Category (Bar)
            const fleetCtx = document.getElementById('fleetChart');
            if (fleetCtx) {
                const labels = Object.keys(statusByCategory);
                const availableData = labels.map(l => statusByCategory[l].available);
                const rentedData = labels.map(l => statusByCategory[l].rented);

                window.fleetChart = new Chart(fleetCtx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Rented',
                                data: rentedData,
                                backgroundColor: '#0095ff',
                                borderRadius: {topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4},
                                barThickness: 16
                            },
                            {
                                label: 'Available',
                                data: availableData,
                                backgroundColor: '#22d3ee',
                                borderRadius: {topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0},
                                barThickness: 16
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } } }
                    }
                });
            }

        } catch (error) {
            console.error("Dashboard init error:", error);
        }
    }
});
