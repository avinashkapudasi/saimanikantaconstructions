// Dynamic Project Loader
// Loads ALL project cards from projects.json via the API — no hardcoded HTML needed.

(function () {
    'use strict';

    var SERVER = '';

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        var container = document.querySelector('.portfolio-container');
        if (!container) return; // not on portfolio page
        loadAllProjects(container);
    }

    // ──────────────────────────────────────────────
    // Fetch projects from API and render cards
    // ──────────────────────────────────────────────
    function loadAllProjects(container) {
        fetch(SERVER + '/api/projects')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                // Remove the loading spinner
                var spinner = document.getElementById('portfolioLoading');
                if (spinner) spinner.remove();

                if (!data.projects || data.projects.length === 0) {
                    container.innerHTML = '<div class="col-12 text-center py-5"><p style="color:#666;">No projects yet. Admin can add projects using the + button above.</p></div>';
                    reinitIsotope();
                    return;
                }

                // Render each project card
                data.projects.forEach(function (project, index) {
                    var card = buildProjectCard(project, index);
                    container.appendChild(card);
                });

                // Re-init Isotope for filtering
                reinitIsotope();

                // Show delete buttons if admin is already logged in
                if (typeof updateAdminFeatures === 'function') {
                    updateAdminFeatures();
                }
            })
            .catch(function (err) {
                console.warn('Could not load projects:', err.message);
                var spinner = document.getElementById('portfolioLoading');
                if (spinner) {
                    spinner.innerHTML = '<p style="color:#c00;"><i class="fas fa-exclamation-triangle"></i> Could not connect to server. Please start the server and refresh.</p>';
                }
            });
    }

    // ──────────────────────────────────────────────
    // Build a single portfolio card DOM element
    // ──────────────────────────────────────────────
    function buildProjectCard(project, index) {
        var delay = ((index % 3) * 0.1 + 0.2).toFixed(1);
        var category = project.category || 'first';
        var folder = project.folder || '';
        var name = project.name || 'Untitled Project';
        var desc = project.description || '';
        var mainImage = project.mainImage || 'img/project-1.jpg';

        // Outer column
        var col = document.createElement('div');
        col.className = 'col-lg-4 col-md-6 col-sm-12 portfolio-item ' + category + ' wow fadeInUp';
        col.setAttribute('data-wow-delay', delay + 's');
        col.setAttribute('data-folder', folder);
        col.setAttribute('data-project-id', project.id || '');

        // Portfolio wrap
        var warp = document.createElement('div');
        warp.className = 'portfolio-warp';

        // Image section
        var imgWrap = document.createElement('div');
        imgWrap.className = 'portfolio-img';

        var img = document.createElement('img');
        img.src = mainImage;
        img.alt = name;
        img.onerror = function () {
            // Fallback: try to load first image from API
            this.onerror = null;
            this.src = 'img/project-1.jpg'; // generic fallback
        };
        imgWrap.appendChild(img);

        var overlay = document.createElement('div');
        overlay.className = 'portfolio-overlay';
        var overlayP = document.createElement('p');
        overlayP.textContent = desc.length > 100 ? desc.substring(0, 100) + '...' : desc;
        overlay.appendChild(overlayP);
        imgWrap.appendChild(overlay);

        warp.appendChild(imgWrap);

        // Text / title section
        var textDiv = document.createElement('div');
        textDiv.className = 'portfolio-text';

        var h3 = document.createElement('h3');
        h3.textContent = name;
        textDiv.appendChild(h3);

        var plusBtn = document.createElement('a');
        plusBtn.className = 'btn';
        plusBtn.href = '#';
        plusBtn.textContent = '+';
        plusBtn.onclick = function (e) {
            e.preventDefault();
            // Build a full project data object to pass to the modal
            var projectData = {
                id: project.id,
                folderName: folder,
                name: name,
                description: desc,
                category: category,
                location: project.location || '',
                status: project.status || '',
                client: project.client || '',
                duration: project.duration || '',
                area: project.area || '',
                type: project.type || ''
            };
            openProjectModal(folder, name, desc, category, projectData);
            return false;
        };
        textDiv.appendChild(plusBtn);

        warp.appendChild(textDiv);
        col.appendChild(warp);

        return col;
    }

    // ──────────────────────────────────────────────
    // Reinitialise Isotope after cards are injected
    // ──────────────────────────────────────────────
    function reinitIsotope() {
        if (typeof $ !== 'undefined' && $.fn.isotope) {
            var $container = $('.portfolio-container');
            // Destroy any old instance and re-init
            if ($container.data('isotope')) {
                $container.isotope('destroy');
            }
            // Wait for images to start loading, then init Isotope
            setTimeout(function () {
                $container.isotope({
                    itemSelector: '.portfolio-item',
                    layoutMode: 'fitRows'
                });
                // Trigger a re-layout after images have had time to load
                setTimeout(function () {
                    $container.isotope('layout');
                }, 800);
            }, 100);

            // Rebind filter buttons
            $('#portfolio-flters li').off('click').on('click', function () {
                $('#portfolio-flters li').removeClass('filter-active');
                $(this).addClass('filter-active');
                $container.isotope({ filter: $(this).data('filter') });
            });
        }
    }

    // ──────────────────────────────────────────────
    // Expose a reload helper for after add / delete
    // ──────────────────────────────────────────────
    window.reloadPortfolioCards = function () {
        var container = document.querySelector('.portfolio-container');
        if (!container) return;
        container.innerHTML = '<div id="portfolioLoading" class="col-12 text-center py-5"><i class="fas fa-spinner fa-spin" style="font-size:32px;color:#fdbe33;"></i><p style="margin-top:10px;color:#666;">Loading projects...</p></div>';
        loadAllProjects(container);
    };

})();
