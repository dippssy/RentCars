(function() {
    // Wait a tick to ensure supabase-config.js has been executed
    // (both scripts are loaded at end of body, so DOM is already ready)
    // === Auth Guard: Protect admin pages (skip on login/register pages) ===
    const isAuthPage = window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html');
    if (!isAuthPage && typeof checkAdminAuth === 'function') {
        checkAdminAuth();
    }

    // === Display user info in sidebar ===
    if (typeof supabaseClient !== 'undefined' && !isAuthPage) {
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                const nameEl = document.getElementById('admin-name');
                const emailEl = document.getElementById('admin-email');
                if (nameEl) nameEl.textContent = session.user.user_metadata?.full_name || 'Admin';
                if (emailEl) emailEl.textContent = session.user.email;
            }
        });
    }

    // === Logout Button ===
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to logout?')) {
                adminLogout();
            }
        });
    }

    // === Sidebar Toggle Logic (Desktop) ===
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const toggleIcon = document.getElementById('toggle-icon');
    
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
            setTimeout(() => {
                if (window.revenueChart) window.revenueChart.resize();
                if (window.rentalsChart) window.rentalsChart.resize();
                if (window.fleetChart) window.fleetChart.resize();
            }, 300);
        });
    }

    // === Mobile Hamburger Menu ===
    const hamburgerBtn = document.getElementById('mobile-menu-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (hamburgerBtn && sidebar) {
        hamburgerBtn.addEventListener('click', () => {
            sidebar.classList.add('mobile-open');
            if (sidebarOverlay) sidebarOverlay.classList.remove('hidden');
        });
    }

    if (sidebarOverlay && sidebar) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            sidebarOverlay.classList.add('hidden');
        });
    }

    // Close sidebar on nav link click (mobile)
    if (sidebar) {
        sidebar.querySelectorAll('nav a').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth < 768) {
                    sidebar.classList.remove('mobile-open');
                    if (sidebarOverlay) sidebarOverlay.classList.add('hidden');
                }
            });
        });
    }

    // === Chart.js & Dashboard Dynamics ===
    if (document.getElementById('revenueChart')) {
        initDashboard();
    }

    async function initDashboard() {
        // Retry mechanism: wait for supabaseClient to be available
        if (typeof supabaseClient === 'undefined') {
            console.warn("supabaseClient not yet available, retrying in 500ms...");
            setTimeout(initDashboard, 500);
            return;
        }

        const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

        try {
            // ========================================
            // 1. FETCH ALL DATA FROM DATABASE
            // ========================================
            let bookings = null;
            let vehicles = null;
            let customers = null;

            // Attempt fetching bookings with relational join
            const { data: bData, error: bErr } = await supabaseClient
                .from('bookings')
                .select('*, customers(full_name), vehicles(name, image_url, image_emoji)')
                .order('created_at', { ascending: false });

            if (bErr) {
                console.warn("Join query failed, falling back to simple select:", bErr.message);
                const { data: bFallback } = await supabaseClient
                    .from('bookings')
                    .select('*')
                    .order('created_at', { ascending: false });
                bookings = bFallback || [];
            } else {
                bookings = bData || [];
            }

            const { data: vData } = await supabaseClient.from('vehicles').select('*');
            vehicles = vData || [];

            const { data: cData } = await supabaseClient.from('customers').select('*');
            customers = cData || [];

            // Build vehicle lookup map (by ID and by name)
            const vehicleMap = {};
            vehicles.forEach(v => {
                vehicleMap[v.id] = v;
                vehicleMap[v.name] = v;
            });

            // ========================================
            // 2. CALCULATE KEY METRICS
            // ========================================
            let totalRevenue = 0;
            let activeBookingsCount = 0;
            let completedBookingsCount = 0;
            let pendingBookingsCount = 0;
            let cancelledBookingsCount = 0;
            const monthlyRevenue = {}; // { 'Jan 2026': 1500000, ... }

            bookings.forEach(b => {
                if (b.status === 'Active' || b.status === 'Completed') {
                    totalRevenue += (b.total_amount || 0);
                }
                if (b.status === 'Active') activeBookingsCount++;
                if (b.status === 'Completed') completedBookingsCount++;
                if (b.status === 'Pending') pendingBookingsCount++;
                if (b.status === 'Cancelled') cancelledBookingsCount++;

                // Group revenue by month
                if ((b.status === 'Active' || b.status === 'Completed') && b.start_date) {
                    const d = new Date(b.start_date);
                    if (!isNaN(d)) {
                        const monthKey = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
                        monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + (b.total_amount || 0);
                    }
                }
            });

            // Vehicle stats
            let totalVehicles = vehicles.length;
            let activeRentalsCount = 0;
            let availableCount = 0;
            let maintenanceCount = 0;
            const categoryCounts = {};
            const statusByCategory = {};

            vehicles.forEach(v => {
                const cat = v.category || 'Other';
                if (!categoryCounts[cat]) {
                    categoryCounts[cat] = 0;
                    statusByCategory[cat] = { available: 0, rented: 0, maintenance: 0 };
                }
                categoryCounts[cat]++;

                if (v.status === 'On Rent') {
                    activeRentalsCount++;
                    statusByCategory[cat].rented++;
                } else if (v.status === 'Available') {
                    availableCount++;
                    statusByCategory[cat].available++;
                } else if (v.status === 'Maintenance') {
                    maintenanceCount++;
                    statusByCategory[cat].maintenance++;
                }
            });

            // Customer stats
            const totalCustomers = customers.length;

            // ========================================
            // 3. UPDATE DASHBOARD WIDGETS
            // ========================================
            const revEl = document.getElementById('total-revenue-text');
            if (revEl) revEl.textContent = formatIDR(totalRevenue);

            const vehEl = document.getElementById('total-vehicles-text');
            if (vehEl) vehEl.textContent = activeRentalsCount;

            // Update category counts
            const suvEl = document.getElementById('count-suv');
            if (suvEl) suvEl.textContent = categoryCounts['SUV'] || 0;
            
            const sedanEl = document.getElementById('count-sedan');
            if (sedanEl) sedanEl.textContent = categoryCounts['MPV'] || 0;
            // Update label to MPV
            const sedanLabel = sedanEl?.closest('li')?.querySelector('.text-text-muted');
            if (sedanLabel) sedanLabel.textContent = 'MPV';

            const luxEl = document.getElementById('count-luxury');
            if (luxEl) luxEl.textContent = categoryCounts['Luxury'] || 0;

            // Update new widgets
            const tbEl = document.getElementById('total-bookings-text');
            if (tbEl) tbEl.textContent = bookings.length;

            const acEl = document.getElementById('active-count');
            if (acEl) acEl.textContent = activeBookingsCount + ' Active';

            const pdEl = document.getElementById('pending-count');
            if (pdEl) pdEl.textContent = pendingBookingsCount + ' Pending';

            const tcEl = document.getElementById('total-customers-text');
            if (tcEl) tcEl.textContent = totalCustomers;

            const ftEl = document.getElementById('fleet-total-label');
            if (ftEl) ftEl.textContent = totalVehicles + ' vehicles';

            // ========================================
            // 4. RECENT BOOKINGS TABLE
            // ========================================
            const recentBody = document.getElementById('recent-bookings-body');
            if (recentBody) {
                if (bookings.length === 0) {
                    recentBody.innerHTML = '<tr><td colspan="3" class="px-6 py-8 text-center text-text-muted">Belum ada data booking di database.</td></tr>';
                } else {
                    let html = '';
                    bookings.slice(0, 5).forEach(b => {
                        const statusColors = {
                            'Completed': 'bg-green-500/10 text-green-400 border-green-500/20',
                            'Active': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                            'Pending': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
                            'Cancelled': 'bg-red-500/10 text-red-400 border-red-500/20'
                        };
                        const statusClass = statusColors[b.status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';

                        // Resolve names with fallback
                        const veh = b.vehicles || {};
                        const cust = b.customers || {};
                        const vehicleName = veh.name || b.vehicle_name || 'Unknown Vehicle';
                        const customerName = cust.full_name || b.customer_name || 'Unknown Customer';

                        // Resolve image with fallback
                        const vLookup = vehicleMap[vehicleName] || vehicleMap[b.vehicle_id] || {};
                        const imgUrl = veh.image_url || vLookup.image_url;
                        const emoji = veh.image_emoji || vLookup.image_emoji || '🚘';

                        const imageDisplay = imgUrl
                            ? `<img src="${imgUrl}" alt="${vehicleName}" class="w-10 h-10 rounded-lg object-cover">`
                            : `<div class="w-10 h-10 rounded-lg bg-[#252833] flex items-center justify-center text-xl">${emoji}</div>`;

                        html += `
                            <tr class="hover:bg-white/5 transition-colors">
                              <td class="px-4 md:px-6 py-4 flex items-center gap-3">
                                ${imageDisplay}
                                <div>
                                  <p class="text-sm font-semibold">${vehicleName}</p>
                                  <p class="text-xs text-text-muted">${customerName}</p>
                                </div>
                              </td>
                              <td class="px-4 md:px-6 py-4 text-sm">${b.start_date || '-'}</td>
                              <td class="px-4 md:px-6 py-4"><span class="px-2 py-1 ${statusClass} text-xs rounded-full font-medium border">${b.status}</span></td>
                            </tr>
                        `;
                    });
                    recentBody.innerHTML = html;
                }
            }

            // ========================================
            // 5. CHART.JS — INDUSTRY-STANDARD DIAGRAMS
            // ========================================
            Chart.defaults.color = '#8b949e';
            Chart.defaults.font.family = "'Inter', sans-serif";

            // --- 5A. Revenue Chart (Area/Line — Monthly from DB) ---
            const revCtx = document.getElementById('revenueChart');
            if (revCtx) {
                // Build last 6 months labels
                const monthLabels = [];
                const monthData = [];
                const now = new Date();
                for (let i = 5; i >= 0; i--) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const key = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
                    const shortLabel = d.toLocaleString('en-US', { month: 'short' });
                    monthLabels.push(shortLabel);
                    monthData.push(monthlyRevenue[key] || 0);
                }

                const gradient = revCtx.getContext('2d').createLinearGradient(0, 0, 0, 200);
                gradient.addColorStop(0, 'rgba(0, 149, 255, 0.4)');
                gradient.addColorStop(1, 'rgba(0, 149, 255, 0)');

                window.revenueChart = new Chart(revCtx, {
                    type: 'line',
                    data: {
                        labels: monthLabels,
                        datasets: [{
                            label: 'Revenue (Rp)',
                            data: monthData,
                            borderColor: '#0095ff',
                            backgroundColor: gradient,
                            borderWidth: 2.5,
                            tension: 0.4,
                            fill: true,
                            pointBackgroundColor: '#0095ff',
                            pointBorderColor: '#161b22',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 7
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                displayColors: false,
                                callbacks: {
                                    label: (ctx) => formatIDR(ctx.parsed.y)
                                }
                            }
                        },
                        scales: {
                            x: { grid: { display: false } },
                            y: { display: false }
                        }
                    }
                });
            }

            // --- 5B. Active Rentals Donut Chart ---
            const rentCtx = document.getElementById('rentalsChart');
            if (rentCtx) {
                const catLabels = Object.keys(statusByCategory);
                const catRented = catLabels.map(l => statusByCategory[l].rented);
                const palette = ['#2563eb', '#22d3ee', '#1e40af', '#7c3aed', '#f59e0b', '#ef4444'];

                window.rentalsChart = new Chart(rentCtx, {
                    type: 'doughnut',
                    data: {
                        labels: catLabels,
                        datasets: [{
                            data: catRented,
                            backgroundColor: palette.slice(0, catLabels.length),
                            borderWidth: 0,
                            hoverOffset: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '75%',
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => `${ctx.label}: ${ctx.parsed} rented`
                                }
                            }
                        }
                    }
                });
            }

            // --- 5C. Fleet Status — Stacked Bar Chart ---
            const fleetCtx = document.getElementById('fleetChart');
            if (fleetCtx) {
                const catLabels = Object.keys(statusByCategory);
                window.fleetChart = new Chart(fleetCtx, {
                    type: 'bar',
                    data: {
                        labels: catLabels,
                        datasets: [
                            {
                                label: 'On Rent',
                                data: catLabels.map(l => statusByCategory[l].rented),
                                backgroundColor: '#0095ff',
                                borderRadius: 4,
                                barThickness: 18
                            },
                            {
                                label: 'Available',
                                data: catLabels.map(l => statusByCategory[l].available),
                                backgroundColor: '#22d3ee',
                                borderRadius: 4,
                                barThickness: 18
                            },
                            {
                                label: 'Maintenance',
                                data: catLabels.map(l => statusByCategory[l].maintenance),
                                backgroundColor: '#f59e0b',
                                borderRadius: 4,
                                barThickness: 18
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: true,
                                position: 'bottom',
                                labels: {
                                    boxWidth: 10,
                                    usePointStyle: true,
                                    pointStyle: 'circle',
                                    padding: 12,
                                    font: { size: 10 }
                                }
                            }
                        },
                        scales: {
                            x: {
                                stacked: true,
                                grid: { display: false },
                                ticks: { font: { size: 10 } }
                            },
                            y: {
                                stacked: true,
                                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                ticks: {
                                    stepSize: 1,
                                    font: { size: 10 }
                                }
                            }
                        }
                    }
                });
            }

            console.log("Dashboard loaded successfully. Revenue:", formatIDR(totalRevenue), "| Vehicles:", totalVehicles, "| Active Rentals:", activeRentalsCount, "| Bookings:", bookings.length);

        } catch (error) {
            console.error("Dashboard init error:", error);
            // Show error state in UI
            const recentBody = document.getElementById('recent-bookings-body');
            if (recentBody) {
                recentBody.innerHTML = `<tr><td colspan="3" class="px-6 py-8 text-center text-red-400">Error loading data: ${error.message}</td></tr>`;
            }
        }
    }
})();
