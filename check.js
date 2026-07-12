


        // Initialize Firebase
        const firebaseConfig = {
            apiKey: "AIzaSyBUTMFblYIVovOe4F25XCFneJNTlVcoWCA",
            authDomain: "ictex-trade.firebaseapp.com",
            databaseURL: "https://ictex-trade-default-rtdb.firebaseio.com",
            projectId: "ictex-trade",
            storageBucket: "ictex-trade.appspot.com",
            messagingSenderId: "755532704199",
            appId: "1:755532704199:web:b27d7c9e7d0f4ac76291e2"
        };
        firebase.initializeApp(firebaseConfig);
        const database = firebase.database();

        function showToast(msg, isError = false) {
            const notif = document.getElementById('notification');
            notif.innerText = msg;
            notif.className = 'notification show' + (isError ? ' error' : '');
            setTimeout(() => notif.classList.remove('show'), 3000);
        }

        function switchTab(tabId, el) {
            document.querySelectorAll('.tab-pane').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.sidebar-menu li').forEach(l => l.classList.remove('active'));
            document.getElementById('tab-' + tabId).classList.add('active');
            el.classList.add('active');
        }

        // ================= USERS MANAGEMENT =================
        let usersData = {};

        database.ref('users').on('value', (snapshot) => {
            const tbody = document.getElementById('users-table-body');
            tbody.innerHTML = '';
            if (snapshot.exists()) {
                usersData = snapshot.val();
                Object.keys(usersData).forEach(uid => {
                    const u = usersData[uid];
                    const email = u.email || 'Unknown';
                    const main = u.realBalance || 0;
                    const bonus = u.bonusBalance || 0;
                    
                    let pendingCount = 0;
                    if (window.mentorsData && window.mentorsData[uid] && window.mentorsData[uid].pendingSalaries) {
                        pendingCount = Object.values(window.mentorsData[uid].pendingSalaries).filter(s => s.status === 'pending').length;
                    }
                    const pendingBadge = pendingCount > 0 ? `<span style="background:var(--warning); color:#000; padding:2px 6px; border-radius:10px; font-size:0.75rem; font-weight:bold; margin-left:8px;">${pendingCount} Pending Salary</span>` : '';
                    
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${email} ${pendingBadge}</td>
                        <td style="font-size:0.8rem; color:var(--text-secondary);">${uid}</td>
                        <td><span class="badge badge-main">$${main.toFixed(2)}</span></td>
                        <td><span class="badge badge-bonus">$${bonus.toFixed(2)}</span></td>
                        <td><button class="btn btn-small btn-outline" onclick="openUserModal('${uid}')">Edit</button></td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No users found.</td></tr>';
            }
        });

        function openUserModal(uid) {
            const u = usersData[uid];
            if(!u) return;
            document.getElementById('modal-user-uid').value = uid;
            document.getElementById('modal-user-email').innerText = u.name || u.email || uid;
            document.getElementById('modal-main-bal').value = u.realBalance || 0;
            document.getElementById('modal-bonus-bal').value = u.bonusBalance || 0;
            
            // Load trades and pending salaries
            loadUserTrades(uid);
            loadUserPendingSalaries(uid);
            
            document.getElementById('user-modal').style.display = 'flex';
        }

        function closeUserModal() {
            document.getElementById('user-modal').style.display = 'none';
        }

        async function saveUserBalances() {
            const uid = document.getElementById('modal-user-uid').value;
            const mBal = parseFloat(document.getElementById('modal-main-bal').value) || 0;
            const bBal = parseFloat(document.getElementById('modal-bonus-bal').value) || 0;
            try {
                await database.ref(`users/${uid}`).update({
                    realBalance: mBal,
                    bonusBalance: bBal
                });
                showToast('Balances updated successfully!');
            } catch(e) {
                showToast(e.message, true);
            }
        }

        function loadUserTrades(uid) {
            database.ref(`users/${uid}/tradeHistory`).on('value', snap => {
                const tbody = document.getElementById('modal-trades-body');
                tbody.innerHTML = '';
                if(snap.exists() && document.getElementById('modal-user-uid').value === uid) {
                    const trades = snap.val();
                    const sortedTrades = Object.values(trades).sort((a,b) => b.timestamp - a.timestamp);
                    sortedTrades.forEach(t => {
                        let statusBadge = '';
                        if(t.result === 'win') statusBadge = '<span class="badge badge-win">WIN</span>';
                        else if(t.result === 'loss') statusBadge = '<span class="badge badge-loss">LOSS</span>';
                        else statusBadge = '<span class="badge" style="background:#555;">TIE</span>';
                        
                        const timeStr = new Date(t.timestamp).toLocaleString();
                        
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${t.market || 'Unidentified'}</td>
                            <td>$${t.amount}</td>
                            <td>${statusBadge}</td>
                            <td style="font-size:0.8rem;">${timeStr}</td>
                            <td><button class="btn btn-small btn-danger" onclick="deleteTrade('${uid}', '${t.id}')">Delete</button></td>
                        `;
                        tbody.appendChild(tr);
                    });
                } else if(document.getElementById('modal-user-uid').value === uid) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No trade history.</td></tr>';
                }
            });
        }

        async function deleteTrade(uid, tradeId) {
            if(confirm('Are you sure you want to delete this trade?')) {
                await database.ref(`users/${uid}/tradeHistory/${tradeId}`).remove();
                showToast('Trade deleted');
            }
        }

        // ================= SALARIES =================
        database.ref('mentors').on('value', (snapshot) => {
            const tbodyOngoing = document.getElementById('mentors-ongoing-body');
            tbodyOngoing.innerHTML = '';

            if (snapshot.exists()) {
                window.mentorsData = snapshot.val(); // Save globally
                let hasOngoing = false;
                
                Object.keys(window.mentorsData).forEach(uid => {
                    const m = window.mentorsData[uid];
                    if (!m.salaryActive) return; // Only show enrolled users
                    
                    hasOngoing = true;
                    const uInfo = usersData[uid] || {};
                    const nick = uInfo.name || uInfo.email || 'Unknown';
                    const activeUsers = (m.studentCount && m.studentCount.active) || 0;
                    
                    let levelName = "Partner";
                    if (activeUsers >= 50 && activeUsers <= 99) levelName = "Senior Partner";
                    else if (activeUsers >= 100 && activeUsers <= 199) levelName = "Manager";
                    else if (activeUsers >= 200 && activeUsers <= 299) levelName = "Director";
                    else if (activeUsers >= 300) levelName = "VIP Director";

                    let pendingCount = 0;
                    if (m.pendingSalaries) {
                        pendingCount = Object.values(m.pendingSalaries).filter(s => s.status === 'pending').length;
                    }
                    const pendingBadge = pendingCount > 0 ? `<span style="background:var(--warning); color:#000; padding:2px 6px; border-radius:10px; font-size:0.75rem; font-weight:bold; margin-left:8px;">${pendingCount} Pending</span>` : '';

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>
                            <div style="font-weight:600;">${nick} ${pendingBadge}</div>
                            <div style="font-size:0.75rem; color:var(--text-secondary);">${uid}</div>
                        </td>
                        <td><span style="background:var(--action-blue); padding:3px 8px; border-radius:4px; font-size:0.8rem;">${levelName}</span></td>
                        <td style="font-size:0.85rem;">${new Date(m.salaryStartDate || Date.now()).toLocaleDateString()}</td>
                        <td style="font-weight:600; color:var(--accent-color);">${activeUsers}</td>
                        <td><button class="btn btn-small btn-outline" onclick="toggleSalaryAccordion('${uid}')">View Salaries</button></td>
                    `;
                    tbodyOngoing.appendChild(tr);

                    const trAcc = document.createElement('tr');
                    trAcc.id = `acc-${uid}`;
                    trAcc.style.display = 'none';
                    trAcc.innerHTML = `
                        <td colspan="5" style="padding: 0; background: rgba(0,0,0,0.2);">
                            <div style="padding: 20px; border-left: 3px solid var(--action-blue);">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                                    <h4 style="margin:0; color:var(--warning);">Pending Salaries</h4>
                                    <button class="btn btn-small" style="background:var(--warning); color:#000;" onclick="approveAllSalariesForUser('${uid}')">Approve All for User</button>
                                </div>
                                <div id="acc-pending-salaries-${uid}"></div>
                            </div>
                        </td>
                    `;
                    tbodyOngoing.appendChild(trAcc);
                });

                if (!hasOngoing) tbodyOngoing.innerHTML = '<tr><td colspan="5" style="text-align:center;">No enrolled mentors found.</td></tr>';

                // Trigger a re-render of users table to update badges
                database.ref('users').once('value', s => { if(s.exists()) usersData = s.val(); document.getElementById('users-table-body').innerHTML = ''; Object.keys(usersData).forEach(uid => {
                    const u = usersData[uid];
                    const email = u.email || 'Unknown';
                    const main = u.realBalance || 0;
                    const bonus = u.bonusBalance || 0;
                    let pCount = 0;
                    if (window.mentorsData && window.mentorsData[uid] && window.mentorsData[uid].pendingSalaries) {
                        pCount = Object.values(window.mentorsData[uid].pendingSalaries).filter(s => s.status === 'pending').length;
                    }
                    const pBadge = pCount > 0 ? `<span style="background:var(--warning); color:#000; padding:2px 6px; border-radius:10px; font-size:0.75rem; font-weight:bold; margin-left:8px;">${pCount} Pending Salary</span>` : '';
                    
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${email} ${pBadge}</td>
                        <td style="font-size:0.8rem; color:var(--text-secondary);">${uid}</td>
                        <td><span class="badge badge-main">$${main.toFixed(2)}</span></td>
                        <td><span class="badge badge-bonus">$${bonus.toFixed(2)}</span></td>
                        <td><button class="btn btn-small btn-outline" onclick="openUserModal('${uid}')">Edit</button></td>
                    `;
                    document.getElementById('users-table-body').appendChild(tr);
                });});

            } else {
                tbodyOngoing.innerHTML = '<tr><td colspan="4" style="text-align:center;">No mentors data found.</td></tr>';
            }
        });

        function toggleSalaryAccordion(uid) {
            const acc = document.getElementById(`acc-${uid}`);
            if (acc.style.display === 'none') {
                acc.style.display = 'table-row';
                loadAccordionPendingSalaries(uid);
            } else {
                acc.style.display = 'none';
            }
        }

        function loadAccordionPendingSalaries(uid) {
            const container = document.getElementById(`acc-pending-salaries-${uid}`);
            if(!container) return;
            container.innerHTML = '';
            
            if (window.mentorsData && window.mentorsData[uid] && window.mentorsData[uid].pendingSalaries) {
                const pendingList = Object.keys(window.mentorsData[uid].pendingSalaries)
                    .map(k => ({id: k, ...window.mentorsData[uid].pendingSalaries[k]}))
                    .filter(s => s.status === 'pending')
                    .sort((a,b) => b.startDate - a.startDate);
                    
                if (pendingList.length > 0) {
                    pendingList.forEach(p => {
                        const startStr = new Date(p.startDate).toLocaleDateString();
                        const endStr = new Date(p.endDate).toLocaleDateString();
                        
                        // Auto-calculate suggested amount
                        let suggestedAmount = 0;
                        if (p.activeMembers >= 15 && p.activeMembers <= 49) suggestedAmount = 30;
                        else if (p.activeMembers >= 50 && p.activeMembers <= 99) suggestedAmount = 60;
                        else if (p.activeMembers >= 100 && p.activeMembers <= 199) suggestedAmount = 150;
                        else if (p.activeMembers >= 200 && p.activeMembers <= 299) suggestedAmount = 300;
                        else if (p.activeMembers >= 300) suggestedAmount = 750;
                        
                        // Adjust amount if workedDays < 30 (approximate calculation for mid-month joins)
                        if (p.workedDays && p.workedDays < 28) {
                            suggestedAmount = Math.round((suggestedAmount / 30) * p.workedDays);
                        }
                        
                        container.innerHTML += `
                            <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:10px; margin-bottom:10px; display:flex; align-items:center; gap:15px;">
                                <div style="flex:1;">
                                    <div style="font-size:0.9rem; font-weight:bold;">${startStr} - ${endStr}</div>
                                    <div style="font-size:0.8rem; color:var(--text-secondary);">Worked for <span style="color:white; font-weight:bold;">${p.workedDays || 30} Days</span> | Active Members: <span style="color:white; font-weight:bold;">${p.activeMembers}</span></div>
                                </div>
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <input type="number" id="amt-${uid}-${p.id}" class="pending-salary-input-${uid}" data-uid="${uid}" data-cycle="${p.id}" value="${suggestedAmount}" style="width:80px; padding:8px; background:var(--bg-color); border:1px solid rgba(255,255,255,0.2); color:white; border-radius:4px;">
                                    <button class="btn btn-small" onclick="approveSalary('${uid}', '${p.id}')">Approve</button>
                                </div>
                            </div>
                        `;
                    });
                    return;
                }
            }
            
            container.innerHTML = '<p style="color:var(--text-secondary); margin:0;">No pending salaries for this user.</p>';
        }

        // Retain the modal version just in case, but change it to point to the new function
        function loadUserPendingSalaries(uid) {
            const container = document.getElementById('modal-pending-salaries');
            if(container) {
                container.innerHTML = '<button class="btn btn-small btn-outline" onclick="document.querySelector(\\\'button[onclick=\\\\\'showTab(\\\\'salaries\\\\')\\\\\']\\\').click(); closeUserModal(); toggleSalaryAccordion(\\''+uid+'\\');">Manage in Salaries Tab</button>';
            }
        }

        async function approveSalary(uid, cycleId) {
            const amtInput = document.getElementById(`amt-${uid}-${cycleId}`);
            if(!amtInput) return;
            const amt = parseFloat(amtInput.value);
            if(isNaN(amt) || amt <= 0) {
                showToast("Invalid amount", true);
                return;
            }
            
            try {
                const refBal = database.ref(`mentors/${uid}/salaryWallet/balance`);
                const snapBal = await refBal.once('value');
                const currBal = snapBal.val() || 0;
                
                const updates = {};
                updates[`mentors/${uid}/salaryWallet/balance`] = currBal + amt;
                updates[`mentors/${uid}/pendingSalaries/${cycleId}/status`] = 'approved';
                updates[`mentors/${uid}/pendingSalaries/${cycleId}/approvedAt`] = Date.now();
                updates[`mentors/${uid}/pendingSalaries/${cycleId}/approvedAmount`] = amt;
                
                await database.ref().update(updates);
                showToast(`Approved $${amt}!`);
                
                // Refresh modal and accordion view
                loadUserPendingSalaries(uid);
                loadAccordionPendingSalaries(uid);
            } catch(e) {
                showToast(e.message, true);
            }
        }

        async function approveAllSalariesForUser(uid) {
            if(!uid) uid = document.getElementById('modal-user-uid').value;
            const inputs = document.querySelectorAll(`.pending-salary-input-${uid}`);
            if(inputs.length === 0) {
                showToast("No pending salaries to approve.", true);
                return;
            }
            
            if(!confirm(`Are you sure you want to approve and send all ${inputs.length} pending salaries for this user?`)) return;
            
            try {
                const updates = {};
                for(let i=0; i<inputs.length; i++) {
                    const inp = inputs[i];
                    const cycleId = inp.dataset.cycle;
                    const amt = parseFloat(inp.value) || 0;
                    if(amt > 0) {
                        const refBal = database.ref(`mentors/${uid}/salaryWallet/balance`);
                        const snapBal = await refBal.once('value');
                        const currBal = snapBal.val() || 0;
                        
                        updates[`mentors/${uid}/salaryWallet/balance`] = currBal + amt;
                        updates[`mentors/${uid}/pendingSalaries/${cycleId}/status`] = 'approved';
                        updates[`mentors/${uid}/pendingSalaries/${cycleId}/approvedAt`] = Date.now();
                        updates[`mentors/${uid}/pendingSalaries/${cycleId}/approvedAmount`] = amt;
                    }
                }
                
                await database.ref().update(updates);
                showToast("Successfully approved all pending salaries!");
                
                // Refresh modal and accordion view
                loadUserPendingSalaries(uid);
                loadAccordionPendingSalaries(uid);
            } catch (e) {
                showToast(e.message, true);
            }
        }

        // ================= REDEEM CODES =================
        function generateRandomCode() {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = 'ICTEX-';
            for (let i = 0; i < 6; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        }

        document.getElementById('create-code-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('create-btn');
            btn.innerText = 'Creating...'; btn.disabled = true;

            let codeName = document.getElementById('code-name').value.trim().toUpperCase();
            if (!codeName) codeName = generateRandomCode();
            
            const wallet = document.getElementById('code-wallet').value;
            const amount = parseFloat(document.getElementById('code-amount').value);
            const usages = parseInt(document.getElementById('code-usages').value);

            try {
                await database.ref(`redeemCodes/${codeName}`).set({
                    amount: amount, targetWallet: wallet, maxUsages: usages, usagesLeft: usages, createdAt: Date.now()
                });
                showToast(`Code ${codeName} created!`);
                e.target.reset();
            } catch (err) { showToast(err.message, true); }
            btn.innerText = 'Create Code'; btn.disabled = false;
        });

        async function deleteCode(codeName) {
            if (confirm(`Delete code: ${codeName}?`)) {
                await database.ref(`redeemCodes/${codeName}`).remove();
                showToast('Code deleted.');
            }
        }

        database.ref('redeemCodes').on('value', (snapshot) => {
            const tbody = document.getElementById('codes-table-body');
            tbody.innerHTML = '';
            if (snapshot.exists()) {
                const data = snapshot.val();
                const codes = Object.keys(data).map(k => ({ id: k, ...data[k] })).sort((a,b) => b.createdAt - a.createdAt);
                
                codes.forEach(code => {
                    const badgeClass = code.targetWallet === 'main' ? 'badge-main' : 'badge-bonus';
                    const walletTxt = code.targetWallet === 'main' ? 'Main' : 'Bonus';
                    let status = '<span style="color:var(--accent-color);">Active</span>';
                    if (code.usagesLeft <= 0) status = '<span style="color:var(--danger);">Fully Claimed</span>';
                    
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="font-weight:bold; letter-spacing:1px;">${code.id}</td>
                        <td>$${code.amount.toFixed(2)}</td>
                        <td><span class="badge ${badgeClass}">${walletTxt}</span></td>
                        <td>${code.usagesLeft} / ${code.maxUsages}</td>
                        <td>${status}</td>
                        <td><button class="btn btn-small btn-danger" onclick="deleteCode('${code.id}')">Delete</button></td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No codes found.</td></tr>';
            }
        });
    