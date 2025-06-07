import { getAPI } from './api.js';
import { showNotification } from './notifications.js';

let activeZoneId = null;
let zones = [];
let currentZonePage = 1;
const ZONES_PER_PAGE = 5;


export function getActiveZone() {
    return zones.find(z => z.id === activeZoneId);
}

export function getActiveZoneId() {
    return activeZoneId;
}

export function setActiveZoneId(zoneId) {
    activeZoneId = zoneId;
    // Store in local storage to remember selection
    localStorage.setItem('activeZoneId', zoneId);
}

export async function loadZones() {
    try {
        const response = await getAPI('/zones');
        zones = response.zones || [];
        const storedZoneId = localStorage.getItem('activeZoneId');
        if (storedZoneId && zones.some(z => z.id === storedZoneId)) {
            activeZoneId = storedZoneId;
        } else if (zones.length > 0) {
            activeZoneId = zones[0].id;
            localStorage.setItem('activeZoneId', activeZoneId);
        }
        renderZoneSelector();
        return zones;
    } catch (error) {
        console.error('Failed to load zones:', error);
        showNotification(`Failed to load zones: ${error.message}`, 'error');
        return [];
    }
}

export function renderZoneSelector() {
    const zoneSelectorContainer = document.getElementById('zone-selector-container');
    if (!zoneSelectorContainer) return;

    if (zones.length === 0) {
        zoneSelectorContainer.innerHTML = '<p class="text-white">No zones available.</p>';
        return;
    }

    const selectHTML = `
        <select id="zone-selector" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500">
            ${zones.map(zone => `<option value="${zone.id}" ${zone.id === activeZoneId ? 'selected' : ''}>${zone.name}</option>`).join('')}
        </select>
    `;
    zoneSelectorContainer.innerHTML = selectHTML;

    const zoneSelector = document.getElementById('zone-selector');
    zoneSelector.addEventListener('change', (event) => {
        const newZoneId = event.target.value;
        if (newZoneId !== activeZoneId) {
            activeZoneId = newZoneId;
            localStorage.setItem('activeZoneId', activeZoneId);
            // Post a custom event that the app can listen to
            window.dispatchEvent(new CustomEvent('zoneChanged', { detail: { zoneId: activeZoneId } }));
        }
    });
}


export function renderZonesPage() {
    const appContainer = document.getElementById('app');
    appContainer.innerHTML = `
        <div class="p-4 md:p-8">
            <div class="flex justify-between items-center mb-4">
                <h1 class="text-2xl font-bold">Manage Zones</h1>
                <button id="add-zone-btn" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    Add Zone
                </button>
            </div>
            <div id="zones-list" class="space-y-4"></div>
            <div id="zones-pagination" class="mt-4 flex justify-center items-center"></div>
        </div>
    `;

    loadAndRenderZonesList(currentZonePage);

    document.getElementById('add-zone-btn').addEventListener('click', () => showAddZoneModal());
}

async function loadAndRenderZonesList(page) {
    const listContainer = document.getElementById('zones-list');
    listContainer.innerHTML = '<div>Loading...</div>';
    try {
        // We assume 'zones' is already loaded and up-to-date from the initial load
        // Paginate the already loaded zones array
        const totalPages = Math.ceil(zones.length / ZONES_PER_PAGE);
        const startIndex = (page - 1) * ZONES_PER_PAGE;
        const endIndex = startIndex + ZONES_PER_PAGE;
        const pagedZones = zones.slice(startIndex, endIndex);

        if (pagedZones.length > 0) {
            const listHtml = pagedZones.map(zone => {
                 const linkageCardId = `linkage-card-${zone.id}`;
                 return `
                    <div class="card">
                        <div class="flex justify-between items-start">
                            <div>
                                <h2 class="text-xl font-bold">${zone.name}</h2>
                                <p class="text-sm text-gray-500">${zone.id}</p>
                            </div>
                            <div class="flex space-x-2">
                                <button class="link-provider-btn text-green-500 hover:text-green-700" data-zone-id="${zone.id}" data-linkage-card-id="${linkageCardId}">Link Provider</button>
                                <button class="edit-zone-btn text-blue-500 hover:text-blue-700" data-zone-id="${zone.id}" data-zone-name="${zone.name}">Edit</button>
                                <button class="delete-zone-btn text-red-500 hover:text-red-700" data-zone-id="${zone.id}" data-zone-name="${zone.name}">Delete</button>
                            </div>
                        </div>
                        <div id="${linkageCardId}" class="mt-4" style="display: none;"></div>
                    </div>
                 `
            }).join('');
            listContainer.innerHTML = listHtml;
            attachZoneActionListeners();
        } else {
            listContainer.innerHTML = '<p>No zones found.</p>';
        }

        renderZonePagination(page, totalPages);
    } catch (error) {
        console.error('Error rendering zones list:', error);
        listContainer.innerHTML = '<p class="text-red-500">Failed to render zones.</p>';
    }
}


function renderZonePagination(currentPage, totalPages) {
    const paginationContainer = document.getElementById('zones-pagination');
    if (!paginationContainer || totalPages <= 1) {
        if(paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const onPageChange = (newPage) => {
        currentZonePage = newPage;
        loadAndRenderZonesList(newPage);
    };

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    if (currentPage > 1) {
        prevButton.className = 'pagination-button bg-transparent border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700';
        prevButton.onclick = () => onPageChange(currentPage - 1);
    } else {
        prevButton.className = 'pagination-button bg-transparent border border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed';
        prevButton.disabled = true;
    }

    const pageInfo = document.createElement('span');
    pageInfo.className = 'px-4 py-2';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    if (currentPage < totalPages) {
        nextButton.className = 'pagination-button bg-transparent border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700';
        nextButton.onclick = () => onPageChange(currentPage + 1);
    } else {
        nextButton.className = 'pagination-button bg-transparent border border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed';
        nextButton.disabled = true;
    }

    paginationContainer.innerHTML = '';
    paginationContainer.appendChild(prevButton);
    paginationContainer.appendChild(pageInfo);
    paginationContainer.appendChild(nextButton);
}


function attachZoneActionListeners() {
    document.querySelectorAll('.edit-zone-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const zoneId = e.target.dataset.zoneId;
            const zoneName = e.target.dataset.zoneName;
            showEditZoneModal({ id: zoneId, name: zoneName });
        });
    });

    document.querySelectorAll('.delete-zone-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const zoneId = e.target.dataset.zoneId;
            const zoneName = e.target.dataset.zoneName;
            showDeleteZoneConfirm({ id: zoneId, name: zoneName });
        });
    });

    document.querySelectorAll('.link-provider-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const zoneId = e.target.dataset.zoneId;
            const linkageCardId = e.target.dataset.linkageCardId;
            const card = document.getElementById(linkageCardId);
            
            // Toggle visibility
            if (card.style.display === 'none') {
                renderZoneLinkage(zoneId, linkageCardId);
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
                card.innerHTML = ''; // Clear content when hiding
            }
        });
    });
}

async function renderZoneLinkage(zoneId, containerId) {
    const linkageContainer = document.getElementById(containerId);
    linkageContainer.innerHTML = '<p>Loading linkage info...</p>';

    try {
        const zoneDetails = await getAPI(`/zones/${zoneId}`);
        const allProviders = await getAPI('/providers');
        
        const linkedProviderId = zoneDetails.provider_id;

        let content = `
            <div class="p-4 border-t border-gray-200 dark:border-gray-700">
                <h3 class="text-lg font-semibold mb-2">Voucher Provider Zone Linkage</h3>
        `;

        if (linkedProviderId) {
            const linkedProvider = allProviders.providers.find(p => p.id === linkedProviderId);
            content += `
                <p>Currently linked to: <strong>${linkedProvider ? linkedProvider.name : 'Unknown Provider'}</strong> (${linkedProviderId})</p>
                <button class="unlink-provider-btn mt-2 bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-1 px-3 rounded text-sm" data-zone-id="${zoneId}">Unlink</button>
            `;
        } else {
            content += '<p>Not linked to any provider.</p>';
        }

        content += `
            <div class="mt-4">
                <label for="provider-select-${zoneId}" class="block text-sm font-medium">Link to a new provider:</label>
                <div class="flex items-center space-x-2 mt-1">
                    <select id="provider-select-${zoneId}" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500">
                        <option value="">Select a provider</option>
                        ${allProviders.providers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                    <button class="link-new-provider-btn bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded" data-zone-id="${zoneId}">Link</button>
                </div>
            </div>
        </div>`;

        linkageContainer.innerHTML = content;
        attachLinkageActionListeners(zoneId);

    } catch (error) {
        console.error('Error loading linkage info:', error);
        linkageContainer.innerHTML = `<p class="text-red-500">Error: ${error.message}</p>`;
    }
}

function attachLinkageActionListeners(zoneId) {
    const linkageContainer = document.querySelector(`[data-zone-id="${zoneId}"]`).closest('.card');
    
    const unlinkBtn = linkageContainer.querySelector('.unlink-provider-btn');
    if (unlinkBtn) {
        unlinkBtn.addEventListener('click', async () => {
            await updateZoneLinkage(zoneId, null);
        });
    }

    const linkNewBtn = linkageContainer.querySelector('.link-new-provider-btn');
    if (linkNewBtn) {
        linkNewBtn.addEventListener('click', async () => {
            const select = linkageContainer.querySelector(`#provider-select-${zoneId}`);
            const providerId = select.value;
            if (providerId) {
                await updateZoneLinkage(zoneId, providerId);
            } else {
                showNotification('Please select a provider to link.', 'warning');
            }
        });
    }
}


async function updateZoneLinkage(zoneId, providerId) {
    try {
        await getAPI(`/zones/${zoneId}`, 'PATCH', { provider_id: providerId });
        showNotification(`Zone linkage updated successfully.`, 'success');
        // Refresh the linkage card content
        const linkageCard = document.getElementById(`linkage-card-${zoneId}`);
        if(linkageCard && linkageCard.style.display !== 'none') {
            renderZoneLinkage(zoneId, linkageCard.id);
        }
    } catch(error) {
        console.error('Error updating zone linkage:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}


function showAddZoneModal() {
    const modalId = 'add-zone-modal';
    if (document.getElementById(modalId)) return;
    const modalHTML = createZoneModal({
        modalId: modalId,
        title: 'Add New Zone',
        buttonText: 'Add Zone',
    });
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    attachModalEventListeners(modalId, handleAddZone);
}

function showEditZoneModal(zone) {
    const modalId = `edit-zone-modal-${zone.id}`;
    if (document.getElementById(modalId)) return;
    const modalHTML = createZoneModal({
        modalId: modalId,
        title: `Edit Zone: ${zone.name}`,
        buttonText: 'Save Changes',
        zoneName: zone.name,
    });
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    attachModalEventListeners(modalId, (name) => handleEditZone(zone.id, name));
}

function createZoneModal({ modalId, title, buttonText, zoneName = '' }) {
    return `
        <div id="${modalId}" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
            <div class="relative mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white dark:bg-gray-800">
                <div class="mt-3">
                    <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white">${title}</h3>
                    <div class="mt-2 px-7 py-3">
                        <label for="zone-name-input-${modalId}" class="text-left block text-sm font-medium text-gray-700 dark:text-gray-300">Zone Name</label>
                        <input type="text" id="zone-name-input-${modalId}" value="${zoneName}" class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm" required>
                    </div>
                    <div class="items-center px-4 py-3">
                        <button id="submit-zone-${modalId}" class="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700">
                            ${buttonText}
                        </button>
                        <button id="close-modal-${modalId}" class="mt-2 px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-300">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function attachModalEventListeners(modalId, submitHandler) {
    const modal = document.getElementById(modalId);
    const closeBtn = document.getElementById(`close-modal-${modalId}`);
    const submitBtn = document.getElementById(`submit-zone-${modalId}`);
    const input = document.getElementById(`zone-name-input-${modalId}`);

    closeBtn.onclick = () => modal.remove();
    submitBtn.onclick = () => {
        const name = input.value.trim();
        if (name) {
            submitHandler(name);
            modal.remove();
        } else {
            showNotification('Zone name cannot be empty.', 'error');
        }
    };
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.remove();
        }
    };
}


async function handleAddZone(name) {
    try {
        await getAPI('/zones', 'POST', { name });
        showNotification('Zone added successfully!', 'success');
        await loadZones(); // Reload all zones
        renderZonesPage(); // Re-render the zones page
    } catch (error) {
        console.error('Error adding zone:', error);
        showNotification(`Error adding zone: ${error.message}`, 'error');
    }
}

async function handleEditZone(zoneId, name) {
     try {
        await getAPI(`/zones/${zoneId}`, 'PATCH', { name });
        showNotification('Zone updated successfully!', 'success');
        await loadZones(); // Reload all zones
        renderZonesPage(); // Re-render the zones page
    } catch (error) {
        console.error('Error updating zone:', error);
        showNotification(`Error updating zone: ${error.message}`, 'error');
    }
}

function showDeleteZoneConfirm(zone) {
    const modalId = `delete-zone-modal-${zone.id}`;
    if (document.getElementById(modalId)) return;

    const modalHTML = `
        <div id="${modalId}" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
            <div class="relative mx-auto p-5 border w-full max-w-sm shadow-lg rounded-md bg-white dark:bg-gray-800">
                <div class="mt-3 text-center">
                     <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-800">
                        <svg class="h-6 w-6 text-red-600 dark:text-red-300" stroke="currentColor" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    </div>
                    <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white mt-2">Delete Zone</h3>
                    <div class="mt-2 px-7 py-3">
                        <p class="text-sm text-gray-500 dark:text-gray-300">Are you sure you want to delete "${zone.name}"? This action cannot be undone.</p>
                    </div>
                    <div class="items-center px-4 py-3">
                        <button id="confirm-delete-${modalId}" class="px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700">Delete</button>
                        <button id="cancel-delete-${modalId}" class="mt-2 px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-300">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById(modalId);
    document.getElementById(`confirm-delete-${modalId}`).onclick = async () => {
        await handleDeleteZone(zone.id);
        modal.remove();
    };
    document.getElementById(`cancel-delete-${modalId}`).onclick = () => modal.remove();
}

async function handleDeleteZone(zoneId) {
    try {
        await getAPI(`/zones/${zoneId}`, 'DELETE');
        showNotification('Zone deleted successfully!', 'success');
        
        // If the deleted zone was the active one, reset it
        if (activeZoneId === zoneId) {
            localStorage.removeItem('activeZoneId');
            activeZoneId = null;
        }

        await loadZones(); // Reload all zones
        renderZonesPage(); // Re-render the zones page
    } catch(error) {
        console.error('Error deleting zone:', error);
        showNotification(`Error deleting zone: ${error.message}`, 'error');
    }
}
