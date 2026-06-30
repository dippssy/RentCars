document.addEventListener('DOMContentLoaded', () => {
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
        if (!window.supabaseClient) {
            console.error("Supabase client not loaded.");
            return;
        }

        try {
            let { data: bookings, error: bookingsError } = await supabaseClient.from('bookings').select('*, customers(full_name), vehicles(name, image_url, image_emoji)').order('created_at', { ascending: false });
            
            if (bookingsError) {
                console.error("Error fetching bookings with joins:", bookingsError);
                // Fallback to simple select
                const { data: fallbackBookings } = await supabaseClient.from('bookings').select('*').order('created_at', { ascending: false });
                bookings = fallbackBookings;
            }

            const { data: vehicles } = await supabaseClient.from('vehicles').select('*');

            const vehicleMap = {};
            if (vehicles) {
                vehicles.forEach(v => {
                    vehicleMap[v.name] = { url: v.image_url, emoji: v.image_emoji };
                    vehicleMap[v.id] = { url: v.image_url, emoji: v.image_emoji };
                });
            }

            let totalRevenue = 0;
            let recentBookingsHtml = '';
            
            if (bookings && bookings.length > 0) {
                // Calculate Total Revenue (Completed & Active only)
                bookings.forEach((b) => {
                    if (b.status === 'Completed' || b.status === 'Active') {
                        totalRevenue += b.total_amount;
                    }
                });

                // Filter for ongoing bookings (Active or Pending)
                let ongoingBookings = bookings.filter(b => b.status === 'Active' || b.status === 'Pending');
                
                // Fallback to latest bookings if no ongoing bookings exist
                let displayBookings = ongoingBookings.length > 0 ? ongoingBookings : bookings;

                displayBookings.slice(0, 5).forEach((b) => {
                    let statusColor = b.status === 'Completed' ? 'green-500/10 text-green-400' : 
                                      b.status === 'Active' ? 'accent-blue/10 text-accent-blue' : 
                                      b.status === 'Cancelled' ? 'red-500/10 text-red-400' : 'yellow-500/10 text-yellow-400';
                    
                    let veh = b.vehicles || {};
                    let cust = b.customers || {};
                    
                    // Allow fallback to old schema if join failed or if old data still present
                    let vehicleName = veh.name || b.vehicle_name || "Unknown Vehicle";
                    let customerName = cust.full_name || b.customer_name || "Unknown Customer";

                    // Fallback to vehicleMap if join failed
                    let vData = vehicleMap[vehicleName] || vehicleMap[b.vehicle_id] || {};
                    let imgUrl = veh.image_url || vData.url;
                    let emoji = veh.image_emoji || vData.emoji || '🚘';

                    let imageDisplay = imgUrl 
                        ? `<img src="${imgUrl}" alt="${vehicleName}" class="w-10 h-10 rounded-lg object-cover">`
                        : `<div class="w-10 h-10 rounded-lg bg-[#252833] flex items-center justify-center text-xl">${emoji}</div>`;

                    recentBookingsHtml += `
                        <tr class="hover:bg-white/5 transition-colors">
                          <td class="px-4 md:px-6 py-4 flex items-center gap-3">
                            ${imageDisplay}
                            <div>
                              <p class="text-sm font-semibold">${vehicleName}</p>
                              <p class="text-xs text-text-muted">${customerName}</p>
                            </div>
                          </td>
                          <td class="px-4 md:px-6 py-4 text-sm">${b.start_date}</td>
                          <td class="px-4 md:px-6 py-4"><span class="px-2 py-1 bg-${statusColor} text-xs rounded-full font-medium border border-current">${b.status}</span></td>
                        </tr>
                    `;
                });
                document.getElementById('recent-bookings-body').innerHTML = recentBookingsHtml || '<tr><td colspan="3" class="text-center py-4">No recent bookings</td></tr>';
            }

            document.getElementById('total-revenue-text').textContent = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalRevenue);

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
                    if (!categoryCounts[cat]) { categoryCounts[cat] = 0; statusByCategory[cat] = { available: 0, rented: 0 }; }
                    categoryCounts[cat]++;
                    if (v.status === 'On Rent') { activeRentalsCount++; statusByCategory[cat].rented++; }
                    else if (v.status === 'Available') { statusByCategory[cat].available++; }
                });
            }

            document.getElementById('total-vehicles-text').textContent = activeRentalsCount;
            document.getElementById('count-suv').textContent = categoryCounts['SUV'] || 0;
            let sedanLabel = document.getElementById('count-sedan')?.previousElementSibling?.querySelector('span:nth-child(2)');
            if (sedanLabel) sedanLabel.textContent = 'MPV';
            const sedanEl = document.getElementById('count-sedan');
            if (sedanEl) sedanEl.textContent = categoryCounts['MPV'] || 0;
            const luxEl = document.getElementById('count-luxury');
            if (luxEl) luxEl.textContent = categoryCounts['Luxury'] || 0;

            Chart.defaults.color = '#8b949e';
            Chart.defaults.font.family = "'Inter', sans-serif";

            const revCtx = document.getElementById('revenueChart');
            if (revCtx) {
                const gradient = revCtx.getContext('2d').createLinearGradient(0, 0, 0, 400);
                gradient.addColorStop(0, 'rgba(0, 149, 255, 0.5)');
                gradient.addColorStop(1, 'rgba(0, 149, 255, 0)');
                let base = totalRevenue / 7;
                window.revenueChart = new Chart(revCtx, {
                    type: 'line',
                    data: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], datasets: [{ label: 'Revenue (Rp)', data: [base*0.5, base*0.8, base*1.2, base*0.9, base*1.5, base*2.0, base*1.8], borderColor: '#0095ff', backgroundColor: gradient, borderWidth: 3, tension: 0.4, fill: true, pointBackgroundColor: '#0095ff', pointBorderColor: '#161b22', pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { displayColors: false } }, scales: { x: { grid: { display: false } }, y: { display: false } } }
                });
            }

            const rentCtx = document.getElementById('rentalsChart');
            if (rentCtx) {
                window.rentalsChart = new Chart(rentCtx, {
                    type: 'doughnut',
                    data: { labels: ['SUV', 'MPV', 'Luxury', 'Luxury MPV'], datasets: [{ data: [statusByCategory['SUV']?.rented||0, statusByCategory['MPV']?.rented||0, statusByCategory['Luxury']?.rented||0, statusByCategory['Luxury MPV']?.rented||0], backgroundColor: ['#2563eb', '#22d3ee', '#1e40af', '#94a3b8'], borderWidth: 0, hoverOffset: 4 }] },
                    options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }
                });
            }

            const fleetCtx = document.getElementById('fleetChart');
            if (fleetCtx) {
                const labels = Object.keys(statusByCategory);
                window.fleetChart = new Chart(fleetCtx, {
                    type: 'bar',
                    data: { labels, datasets: [{ label: 'Rented', data: labels.map(l => statusByCategory[l].rented), backgroundColor: '#0095ff', borderRadius: {topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4}, barThickness: 16 }, { label: 'Available', data: labels.map(l => statusByCategory[l].available), backgroundColor: '#22d3ee', borderRadius: {topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0}, barThickness: 16 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } } } }
                });
            }

        } catch (error) {
            console.error("Dashboard init error:", error);
        }
    }
});
