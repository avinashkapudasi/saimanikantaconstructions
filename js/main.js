(function ($) {
    "use strict";
    
    // Initiate the wowjs
    new WOW().init();
    
    
    // Back to top button
    $(window).scroll(function () {
        if ($(this).scrollTop() > 200) {
            $('.back-to-top').fadeIn('slow');
        } else {
            $('.back-to-top').fadeOut('slow');
        }
    });
    $('.back-to-top').click(function () {
        $('html, body').animate({scrollTop: 0}, 1500, 'easeInOutExpo');
        return false;
    });
    
    
    // Sticky Navbar
    $(window).scroll(function () {
        if ($(this).scrollTop() > 90) {
            $('.nav-bar').addClass('nav-sticky');
            $('.carousel, .page-header').css("margin-top", "73px");
        } else {
            $('.nav-bar').removeClass('nav-sticky');
            $('.carousel, .page-header').css("margin-top", "0");
        }
    });
    
    
    
    // Dropdown on mouse hover
    $(document).ready(function () {
        function toggleNavbarMethod() {
            if ($(window).width() > 992) {
                $('.navbar .dropdown').on('mouseover', function () {
                    $('.dropdown-toggle', this).trigger('click');
                }).on('mouseout', function () {
                    $('.dropdown-toggle', this).trigger('click').blur();
                });
            } else {
                $('.navbar .dropdown').off('mouseover').off('mouseout');
            }
        }
        toggleNavbarMethod();
        $(window).resize(toggleNavbarMethod);
    });
    
    
    // jQuery counterUp
    $('[data-toggle="counter-up"]').counterUp({
        delay: 10,
        time: 2000
    });
    
    
    // Modal Video
    $(document).ready(function () {
        var $videoSrc;
        $('.btn-play').click(function () {
            $videoSrc = $(this).data("src");
        });
        console.log($videoSrc);

        $('#videoModal').on('shown.bs.modal', function (e) {
            $("#video").attr('src', $videoSrc + "?autoplay=1&amp;modestbranding=1&amp;showinfo=0");
        })

        $('#videoModal').on('hide.bs.modal', function (e) {
            $("#video").attr('src', $videoSrc);
        })
    });


    // Testimonial Slider
    $('.testimonial-slider').slick({
        infinite: true,
        autoplay: true,
        arrows: false,
        dots: false,
        slidesToShow: 1,
        slidesToScroll: 1,
        asNavFor: '.testimonial-slider-nav'
    });
    $('.testimonial-slider-nav').slick({
        arrows: false,
        dots: false,
        focusOnSelect: true,
        centerMode: true,
        centerPadding: '22px',
        slidesToShow: 3,
        asNavFor: '.testimonial-slider'
    });
    $('.testimonial .slider-nav').css({"position": "relative", "height": "160px"});
    
    
    // Blogs carousel
    $(".related-slider").owlCarousel({
        autoplay: true,
        dots: false,
        loop: true,
        nav : true,
        navText : [
            '<i class="fa fa-angle-left" aria-hidden="true"></i>',
            '<i class="fa fa-angle-right" aria-hidden="true"></i>'
        ],
        responsive: {
            0:{
                items:1
            },
            576:{
                items:1
            },
            768:{
                items:2
            }
        }
    });
    
    
    // Portfolio isotope and filter â€” handled by project-loader.js after cards are loaded dynamically
    // Keep filter-click binding here as a fallback for pages that don't use project-loader
    $('#portfolio-flters li').on('click', function () {
        $("#portfolio-flters li").removeClass('filter-active');
        $(this).addClass('filter-active');

        if ($('.portfolio-container').data('isotope')) {
            $('.portfolio-container').isotope({filter: $(this).data('filter')});
        }
    });
    
    
    // Admin Login Session Management
    function checkAdminLogin() {
        return sessionStorage.getItem('adminLoggedIn') === 'true';
    }
    
    function setAdminLogin(status) {
        sessionStorage.setItem('adminLoggedIn', status);
    }
    
    function updateAdminButton() {
        var adminBtn = document.getElementById("adminLoginBtn");
        if (adminBtn) {
            if (checkAdminLogin()) {
                adminBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
                adminBtn.title = "Logout from admin";
            } else {
                adminBtn.innerHTML = '<i class="fas fa-user-shield"></i> Admin';
                adminBtn.title = "Admin Login";
            }
        }
    }
    
    function updateAdminFeatures() {
        var addProjectBtn = document.getElementById("addProjectBtn");
        if (addProjectBtn) {
            if (checkAdminLogin()) {
                addProjectBtn.style.display = "inline-block";
            } else {
                addProjectBtn.style.display = "none";
            }
        }
    }
    
    // Admin Login Modal
    var adminModal = document.getElementById("adminLoginModal");
    var adminBtn = document.getElementById("adminLoginBtn");
    var adminSpan = document.getElementsByClassName("admin-close")[0];
    
    // Initialize admin features on page load
    updateAdminButton();
    updateAdminFeatures();
    
    // Open modal when admin button is clicked or logout
    if (adminBtn) {
        adminBtn.onclick = function(e) {
            e.preventDefault();
            
            if (checkAdminLogin()) {
                // User is logged in, perform logout
                if (confirm("Are you sure you want to logout?")) {
                    setAdminLogin('false');
                    updateAdminButton();
                    updateAdminFeatures();
                    alert("You have been logged out successfully.");
                }
            } else {
                // User is not logged in, show login modal
                adminModal.style.display = "block";
                document.getElementById("adminUsername").value = "";
                document.getElementById("adminPassword").value = "";
                document.getElementById("adminLoginError").classList.remove("show");
            }
        }
    }
    
    // Close modal when X is clicked
    if (adminSpan) {
        adminSpan.onclick = function() {
            adminModal.style.display = "none";
        }
    }
    
    // Close modal when clicking outside of it
    window.onclick = function(event) {
        if (event.target == adminModal) {
            adminModal.style.display = "none";
        }
    }
    
    // Handle admin login form submission
    var adminLoginForm = document.getElementById("adminLoginForm");
    if (adminLoginForm) {
        adminLoginForm.onsubmit = function(e) {
            e.preventDefault();
            
            var username = document.getElementById("adminUsername").value;
            var password = document.getElementById("adminPassword").value;
            var errorDiv = document.getElementById("adminLoginError");
            
            // Default credentials
            var defaultUsername = "adminsmcs";
            var defaultPassword = "smcs@9491";
            
            if (username === defaultUsername && password === defaultPassword) {
                // Successful login
                errorDiv.classList.remove("show");
                adminModal.style.display = "none";
                
                // Set login session
                setAdminLogin('true');
                updateAdminButton();
                updateAdminFeatures();
                
                alert("Login successful! Welcome Admin.");
                
            } else {
                // Failed login
                errorDiv.textContent = "Invalid username or password!";
                errorDiv.classList.add("show");
                
                // Clear password field
                document.getElementById("adminPassword").value = "";
            }
        }
    }
    
    // Add Project Button Click Handler
    var addProjectBtn = document.getElementById("addProjectBtn");
    if (addProjectBtn) {
        addProjectBtn.onclick = function() {
            openAddProjectModal();
        }
    }
    
    // Add Project Modal Functions
    function openAddProjectModal() {
        var modal = document.getElementById("addProjectModal");
        if (modal) {
            modal.style.display = "block";
            // Reset form
            document.getElementById("addProjectForm").reset();
            document.getElementById("imagePreviewContainer").innerHTML = "";
            document.getElementById("addProjectError").classList.remove("show");
            document.getElementById("addProjectSuccess").classList.remove("show");
        }
    }
    
    window.closeAddProjectModal = function() {
        var modal = document.getElementById("addProjectModal");
        if (modal) {
            modal.style.display = "none";
        }
    }
    
    // Close modal when clicking X
    var addProjectClose = document.getElementsByClassName("add-project-close")[0];
    if (addProjectClose) {
        addProjectClose.onclick = function() {
            closeAddProjectModal();
        }
    }
    
    // Close modal when clicking outside
    window.onclick = function(event) {
        var adminModal = document.getElementById("adminLoginModal");
        var addProjectModal = document.getElementById("addProjectModal");
        
        if (event.target == adminModal) {
            adminModal.style.display = "none";
        }
        if (event.target == addProjectModal) {
            closeAddProjectModal();
        }
    }
    
    // Image preview functionality
    var projectImagesInput = document.getElementById("projectImages");
    if (projectImagesInput) {
        projectImagesInput.onchange = function(e) {
            var previewContainer = document.getElementById("imagePreviewContainer");
            previewContainer.innerHTML = "";
            
            var files = e.target.files;
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                var reader = new FileReader();
                
                reader.onload = (function(index) {
                    return function(e) {
                        var div = document.createElement("div");
                        div.className = "image-preview-item";
                        
                        var img = document.createElement("img");
                        img.src = e.target.result;
                        
                        if (index === 0) {
                            var badge = document.createElement("span");
                            badge.className = "preview-badge";
                            badge.textContent = "MAIN";
                            div.appendChild(badge);
                        }
                        
                        div.appendChild(img);
                        previewContainer.appendChild(div);
                    };
                })(i);
                
                reader.readAsDataURL(file);
            }
        }
    }
    
    // Auto-generate folder name from project name
    var projectNameInput = document.getElementById("projectName");
    var projectFolderInput = document.getElementById("projectFolder");
    if (projectNameInput && projectFolderInput) {
        projectNameInput.oninput = function() {
            var folderName = this.value
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .trim();
            projectFolderInput.value = folderName;
        }
    }
    
    // Handle Add Project Form Submission
    var addProjectForm = document.getElementById("addProjectForm");
    if (addProjectForm) {
        addProjectForm.onsubmit = function(e) {
            e.preventDefault();
            
            var errorDiv = document.getElementById("addProjectError");
            var successDiv = document.getElementById("addProjectSuccess");
            errorDiv.classList.remove("show");
            successDiv.classList.remove("show");
            
            // Get form data
            var formData = new FormData(this);
            
            // Show loading state
            var submitBtn = this.querySelector('button[type="submit"]');
            var originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            submitBtn.disabled = true;
            
            // Send to server
            fetch('/api/projects', {
                method: 'POST',
                body: formData
            })
            .then(function(response) {
                return response.json();
            })
            .then(function(data) {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                
                if (data.success) {
                    successDiv.textContent = data.message || 'Project added successfully!';
                    successDiv.classList.add("show");
                    
                    // Reset form after 2 seconds and close modal, then reload cards dynamically
                    setTimeout(function() {
                        closeAddProjectModal();
                        // Reload project cards dynamically (no full page reload)
                        if (typeof reloadPortfolioCards === 'function') {
                            reloadPortfolioCards();
                        } else {
                            location.reload();
                        }
                    }, 2000);
                } else {
                    errorDiv.textContent = data.error || 'Failed to add project';
                    errorDiv.classList.add("show");
                }
            })
            .catch(function(error) {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                errorDiv.textContent = 'Error: ' + error.message + '. Make sure the server is running.';
                errorDiv.classList.add("show");
            });
        }
    }
    
})(jQuery);

// Global admin helper (accessible outside the jQuery IIFE)
function isAdminLoggedIn() {
    return sessionStorage.getItem('adminLoggedIn') === 'true';
}

// Dynamically build the project details grid from the project JSON object.
// Only fields with non-empty values are shown.
function buildDetailsGrid(projectData) {
    var grid = document.getElementById('projectDetailsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    // Field map: key â†’ { label, icon }
    var fields = [
        { key: 'location',  label: 'Location',     icon: 'fa-map-marker-alt' },
        { key: 'status',    label: 'Status',        icon: 'fa-tasks' },
        { key: 'client',    label: 'Client',        icon: 'fa-user' },
        { key: 'duration',  label: 'Duration',      icon: 'fa-clock' },
        { key: 'area',      label: 'Area',          icon: 'fa-ruler-combined' },
        { key: 'type',      label: 'Project Type',  icon: 'fa-building' }
    ];

    var hasAny = false;

    fields.forEach(function (f) {
        var val = projectData[f.key];
        if (!val || !val.toString().trim()) return;

        hasAny = true;

        var item = document.createElement('div');
        item.className = 'project-detail-item';

        var icon = document.createElement('i');
        icon.className = 'fas ' + f.icon;
        item.appendChild(icon);

        var content = document.createElement('div');
        content.className = 'project-detail-content';

        var h4 = document.createElement('h4');
        h4.textContent = f.label;
        content.appendChild(h4);

        var p = document.createElement('p');
        p.textContent = val;
        p.id = 'projectDetail_' + f.key; // allow saveProjectData to update it
        content.appendChild(p);

        item.appendChild(content);
        grid.appendChild(item);
    });

    // Hide the whole grid if every field is empty
    grid.style.display = hasAny ? 'grid' : 'none';
}

// Project Details Modal Functions
var projectModal = document.getElementById("projectModal");
var projectCloseBtn = document.querySelector(".project-close");
var currentProjectImages = [];
var currentImageIndex = 0;
var currentProjectData = null; // Store current project data for editing/deleting

// Close project modal function
function closeProjectModal() {
    var modal = document.getElementById("projectModal");
    if (modal) {
        modal.style.display = "none";
        document.body.style.overflow = "auto"; // Restore body scroll
        
        // Reset edit mode
        var editSection = document.getElementById('editProjectSection');
        if (editSection) editSection.classList.remove('show');
        
        // Reset gallery edit state
        galleryEditingActive = false;
        var uploadZone = document.getElementById('galleryUploadZone');
        var galleryContainer = document.getElementById('projectGalleryContainer');
        if (uploadZone) uploadZone.style.display = 'none';
        if (galleryContainer) galleryContainer.classList.remove('gallery-editing');

        // Restore details grid / description
        var dg = document.getElementById('projectDetailsGrid');
        var ds = document.getElementById('projectDescriptionSection');
        if (dg) dg.style.display = 'grid';
        if (ds) ds.style.display = 'block';
        
        // Reset data
        currentProjectData = null;
        currentProjectImages = [];
    }
}

// Set up modal close event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Close button click
    var projectCloseBtn = document.querySelector(".project-close");
    if (projectCloseBtn) {
        projectCloseBtn.onclick = function() {
            closeProjectModal();
        };
    }
    
    // Click outside modal to close
    var projectModal = document.getElementById("projectModal");
    if (projectModal) {
        projectModal.addEventListener('click', function(event) {
            if (event.target === projectModal) {
                closeProjectModal();
            }
        });
    }
    
    // ESC key to close
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            var modal = document.getElementById("projectModal");
            if (modal && modal.style.display === "block") {
                closeProjectModal();
            }
        }
    });
});

// Open project modal and load images
function openProjectModal(folderName, projectName, projectDescription, category, projectData) {
    var modal = document.getElementById("projectModal");
    var titleEl = document.getElementById("projectModalTitle");
    var descEl = document.getElementById("projectModalDescription");
    var categoryEl = document.getElementById("projectModalCategory");
    var mainImageContainer = document.getElementById("projectMainImageContainer");
    var galleryContainer = document.getElementById("projectGalleryContainer");
    var noImagesDiv = document.getElementById("projectNoImages");
    
    // Store project data for admin operations
    currentProjectData = projectData || {
        folderName: folderName,
        name: projectName,
        description: projectDescription,
        category: category,
        location: '',
        status: '',
        client: '',
        duration: '',
        area: '',
        type: ''
    };
    
    // Set project info
    titleEl.textContent = projectName;
    descEl.textContent = projectDescription;
    
    // Set category badge
    var categoryText = category === 'first' ? 'Complete' : 'Running';
    categoryEl.textContent = categoryText;
    categoryEl.style.backgroundColor = category === 'first' ? '#28a745' : '#fdbe33';
    
    // Dynamically build project details grid from JSON data
    buildDetailsGrid(currentProjectData);
    
    // Show/hide description section based on whether description exists
    var descSection = document.getElementById('projectDescriptionSection');
    if (currentProjectData.description && currentProjectData.description.trim()) {
        descSection.style.display = 'block';
    } else {
        descSection.style.display = 'none';
    }
    
    // Show/hide admin controls
    var adminControls = document.getElementById('projectAdminControls');
    if (isAdminLoggedIn()) {
        adminControls.classList.add('show');
    } else {
        adminControls.classList.remove('show');
    }
    
    // Hide edit section by default
    document.getElementById('editProjectSection').classList.remove('show');
    // Don't override the details grid visibility â€” buildDetailsGrid already handles it
    document.getElementById('projectDescriptionSection').style.display = 'block';
    
    // Clear previous images
    mainImageContainer.innerHTML = '';
    galleryContainer.innerHTML = '';
    currentProjectImages = [];
    
    // Reset gallery to collapsed by default
    var galleryWrapper = document.getElementById('galleryCollapseWrapper');
    var galleryIcon = document.getElementById('galleryToggleIcon');
    if (galleryWrapper) galleryWrapper.style.display = 'none';
    if (galleryIcon) {
        galleryIcon.classList.remove('fa-chevron-up');
        galleryIcon.classList.add('fa-chevron-down');
    }
    // Reset image count
    var countBadge = document.getElementById('galleryImageCount');
    if (countBadge) countBadge.textContent = '';
    
    // Try to load images from the folder
    loadProjectImages(folderName, mainImageContainer, galleryContainer, noImagesDiv);
    
    // Show modal
    modal.style.display = "block";
    document.body.style.overflow = "hidden"; // Prevent body scroll
}

// Load project images from folder (prefers API, falls back to probing)
function loadProjectImages(folderName, mainImageContainer, galleryContainer, noImagesDiv) {
    // Try the API first (reliable)
    fetch('/api/projects/' + folderName + '/images')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.images && data.images.length > 0) {
                var paths = data.images.map(function (img) { return img.path; });
                renderImages(paths, mainImageContainer, galleryContainer, noImagesDiv, folderName, data.images);
            } else {
                probeImagesLegacy(folderName, mainImageContainer, galleryContainer, noImagesDiv);
            }
        })
        .catch(function () {
            probeImagesLegacy(folderName, mainImageContainer, galleryContainer, noImagesDiv);
        });
}

// Legacy image-probing fallback (when server is offline)
function probeImagesLegacy(folderName, mainImageContainer, galleryContainer, noImagesDiv) {
    var extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'JPG', 'JPEG', 'PNG', 'GIF', 'WEBP'];
    var loadedImages = [];
    var imagesToLoad = [];

    for (var n = 1; n <= 20; n++) {
        extensions.forEach(function (ext) {
            imagesToLoad.push('img/' + folderName + '/IMG-20240307-WA0' + (n < 10 ? '0' : '') + n + '.' + ext);
            imagesToLoad.push('img/' + folderName + '/' + n + '.' + ext);
        });
    }
    // Also try main image
    extensions.forEach(function (ext) {
        imagesToLoad.push('img/' + folderName + '/main.' + ext);
    });

    var done = 0;
    imagesToLoad.forEach(function (src) {
        var img = new Image();
        img.onload = function () { loadedImages.push(src); };
        img.onerror = function () { };
        img.onloadend = function () {
            done++;
            if (done >= imagesToLoad.length) {
                setTimeout(function () {
                    renderImages(loadedImages, mainImageContainer, galleryContainer, noImagesDiv, folderName, null);
                }, 200);
            }
        };
        img.src = src;
    });
}

// Track whether gallery is in editing mode
var galleryEditingActive = false;

// Render loaded images in modal
function renderImages(images, mainImageContainer, galleryContainer, noImagesDiv, folderName, rawImageData) {
    currentProjectImages = images;

    // Update image count badge
    var countBadge = document.getElementById('galleryImageCount');
    if (countBadge) {
        countBadge.textContent = '(' + images.length + ' image' + (images.length !== 1 ? 's' : '') + ')';
    }

    if (images.length === 0) {
        mainImageContainer.style.display = 'none';
        galleryContainer.style.display = 'none';
        noImagesDiv.style.display = 'block';
        return;
    }

    noImagesDiv.style.display = 'none';
    mainImageContainer.style.display = 'block';
    galleryContainer.style.display = 'grid';

    // Main image
    var mainImg = document.createElement('img');
    mainImg.src = images[0];
    mainImg.alt = 'Main project image';
    mainImg.style.width = '100%';
    mainImg.style.borderRadius = '8px';
    mainImg.style.cursor = 'pointer';
    mainImg.onclick = function () { openLightbox(0); };
    mainImageContainer.appendChild(mainImg);

    // "Current main image" label under the main image
    var mainLabel = document.createElement('p');
    mainLabel.className = 'main-image-label';
    mainLabel.innerHTML = '<i class="fas fa-star" style="color:#fdbe33;"></i> Current Main Image â€” <em>hover any thumbnail below and click â˜… to change</em>';
    mainImageContainer.appendChild(mainLabel);

    // Build thumbnails with edit overlays
    images.forEach(function (imgPath, index) {
        var thumbDiv = document.createElement('div');
        thumbDiv.className = 'project-gallery-item';

        // Determine filename and whether it's the main image
        var filename = imgPath.split('/').pop();
        var isMain = rawImageData ? rawImageData[index] && rawImageData[index].isMain : filename.toLowerCase().startsWith('main.');

        // Mark the main image with a special class for highlighting
        if (isMain) {
            thumbDiv.classList.add('gallery-item-is-main');

            var badge = document.createElement('span');
            badge.className = 'gallery-img-main-badge';
            badge.textContent = 'MAIN';
            thumbDiv.appendChild(badge);
        }

        // Image
        var thumb = document.createElement('img');
        thumb.src = imgPath;
        thumb.alt = 'Project image ' + (index + 1);
        thumb.onclick = function () {
            if (!galleryEditingActive) openLightbox(index);
        };
        thumbDiv.appendChild(thumb);

        // "Set as main" hover overlay â€” always visible on hover for admins
        if (!isMain && isAdminLoggedIn()) {
            var setMainOverlay = document.createElement('div');
            setMainOverlay.className = 'gallery-set-main-overlay';
            setMainOverlay.title = 'Set as main image';
            setMainOverlay.innerHTML = '<i class="fas fa-star"></i><span>Set as Main</span>';
            setMainOverlay.onclick = (function (fn, fld) {
                return function (e) {
                    e.stopPropagation();
                    setImageAsMain(fld, fn);
                };
            })(filename, folderName);
            thumbDiv.appendChild(setMainOverlay);
        }

        // Edit-mode overlay (delete + set-main buttons, shown only in gallery editing)
        var overlay = document.createElement('div');
        overlay.className = 'gallery-edit-controls';

        // Set-as-main button (edit mode)
        if (!isMain) {
            var mainBtn = document.createElement('button');
            mainBtn.className = 'gallery-img-main-btn';
            mainBtn.title = 'Set as main image';
            mainBtn.innerHTML = '<i class="fas fa-star"></i>';
            mainBtn.onclick = (function (fn, fld) {
                return function (e) { e.stopPropagation(); setImageAsMain(fld, fn); };
            })(filename, folderName);
            overlay.appendChild(mainBtn);
        }

        // Delete button (edit mode only)
        var delBtn = document.createElement('button');
        delBtn.className = 'gallery-img-delete-btn';
        delBtn.title = 'Delete image';
        delBtn.innerHTML = '<i class="fas fa-trash"></i>';
        delBtn.onclick = (function (fn, fld, el) {
            return function (e) { e.stopPropagation(); deleteGalleryImage(fld, fn, el); };
        })(filename, folderName, thumbDiv);
        overlay.appendChild(delBtn);

        thumbDiv.appendChild(overlay);
        galleryContainer.appendChild(thumbDiv);
    });

    // If edit mode is already active when images finish loading, apply editing class
    if (galleryEditingActive) {
        galleryContainer.classList.add('gallery-editing');
    }
}

// ===== Gallery image management =====

function deleteGalleryImage(folderName, filename, element) {
    if (!confirm('Delete this image?')) return;

    fetch('/api/projects/' + folderName + '/images/' + encodeURIComponent(filename), {
        method: 'DELETE'
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
        if (data.success) {
            // Remove from DOM
            if (element && element.parentNode) element.parentNode.removeChild(element);
            // Remove from in-memory array
            currentProjectImages = currentProjectImages.filter(function (p) {
                return p.indexOf(filename) === -1;
            });
        } else {
            alert('Failed to delete image: ' + (data.error || 'Unknown error'));
        }
    })
    .catch(function () {
        alert('Server not available. Cannot delete image.');
    });
}

function setImageAsMain(folderName, filename) {
    fetch('/api/projects/' + folderName + '/images/' + encodeURIComponent(filename) + '/set-main', {
        method: 'PUT'
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
        if (data.success) {
            // Refresh the gallery to show the new main image
            refreshGallery(folderName);

            // Also update the portfolio card thumbnail if visible
            var card = document.querySelector('.portfolio-item[data-folder="' + folderName + '"]');
            if (card && data.mainImage) {
                var cardImg = card.querySelector('.portfolio-img img');
                if (cardImg) cardImg.src = data.mainImage;
            }
        } else {
            alert('Failed to set main image.');
        }
    })
    .catch(function () {
        alert('Server not available.');
    });
}

function refreshGallery(folderName) {
    var mainImageContainer = document.getElementById('projectMainImageContainer');
    var galleryContainer = document.getElementById('projectGalleryContainer');
    var noImagesDiv = document.getElementById('projectNoImages');

    mainImageContainer.innerHTML = '';
    galleryContainer.innerHTML = '';
    currentProjectImages = [];

    loadProjectImages(folderName, mainImageContainer, galleryContainer, noImagesDiv);
}

// ===== Gallery upload =====

function uploadGalleryImages(files, folderName) {
    if (!files || files.length === 0) return;

    var formData = new FormData();
    formData.append('projectFolder', folderName);
    for (var i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
    }

    var progressWrap = document.getElementById('galleryUploadProgress');
    var progressBar = document.getElementById('galleryUploadBar');
    progressWrap.style.display = 'block';
    progressBar.style.width = '30%';

    fetch('/api/projects/' + folderName + '/images', {
        method: 'POST',
        body: formData
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
        progressBar.style.width = '100%';
        setTimeout(function () {
            progressWrap.style.display = 'none';
            progressBar.style.width = '0%';
        }, 600);

        if (data.success) {
            refreshGallery(folderName);
        } else {
            alert('Upload failed: ' + (data.error || 'Unknown error'));
        }
    })
    .catch(function () {
        progressWrap.style.display = 'none';
        progressBar.style.width = '0%';
        alert('Server not available. Cannot upload images.');
    });
}

// Wire up upload zone events
document.addEventListener('DOMContentLoaded', function () {
    var zone = document.getElementById('galleryUploadZone');
    var fileInput = document.getElementById('galleryFileInput');
    if (!zone || !fileInput) return;

    zone.addEventListener('click', function () { fileInput.click(); });

    fileInput.addEventListener('change', function () {
        if (currentProjectData && fileInput.files.length > 0) {
            uploadGalleryImages(fileInput.files, currentProjectData.folderName);
            fileInput.value = '';
        }
    });

    zone.addEventListener('dragover', function (e) {
        e.preventDefault();
        zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', function () {
        zone.classList.remove('drag-over');
    });
    zone.addEventListener('drop', function (e) {
        e.preventDefault();
        zone.classList.remove('drag-over');
        if (currentProjectData && e.dataTransfer.files.length > 0) {
            uploadGalleryImages(e.dataTransfer.files, currentProjectData.folderName);
        }
    });
});

// Lightbox functions
function openLightbox(index) {
    currentImageIndex = index;
    var lightbox = document.getElementById('imageLightbox');
    var lightboxImg = document.getElementById('lightboxImage');
    
    if (lightbox && lightboxImg && currentProjectImages.length > 0) {
        lightboxImg.src = currentProjectImages[index];
        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeLightbox() {
    var lightbox = document.getElementById('imageLightbox');
    if (lightbox) {
        lightbox.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function nextLightboxImage() {
    if (currentProjectImages.length === 0) return;
    currentImageIndex = (currentImageIndex + 1) % currentProjectImages.length;
    document.getElementById('lightboxImage').src = currentProjectImages[currentImageIndex];
}

function prevLightboxImage() {
    if (currentProjectImages.length === 0) return;
    currentImageIndex = (currentImageIndex - 1 + currentProjectImages.length) % currentProjectImages.length;
    document.getElementById('lightboxImage').src = currentProjectImages[currentImageIndex];
}

// Set up lightbox event listeners
document.addEventListener('DOMContentLoaded', function() {
    var lightboxClose = document.querySelector('.lightbox-close');
    var lightboxNext = document.querySelector('.lightbox-next');
    var lightboxPrev = document.querySelector('.lightbox-prev');
    var lightbox = document.getElementById('imageLightbox');
    
    if (lightboxClose) {
        lightboxClose.onclick = closeLightbox;
    }
    
    if (lightboxNext) {
        lightboxNext.onclick = nextLightboxImage;
    }
    
    if (lightboxPrev) {
        lightboxPrev.onclick = prevLightboxImage;
    }
    
    if (lightbox) {
        lightbox.onclick = function(event) {
            if (event.target === lightbox) {
                closeLightbox();
            }
        };
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', function(event) {
        var lightbox = document.getElementById('imageLightbox');
        if (lightbox && lightbox.style.display === 'flex') {
            if (event.key === 'Escape') {
                closeLightbox();
            } else if (event.key === 'ArrowRight') {
                nextLightboxImage();
            } else if (event.key === 'ArrowLeft') {
                prevLightboxImage();
            }
        }
    });

    // Gallery collapse / expand toggle
    var galleryToggleBtn = document.getElementById('galleryToggleBtn');
    if (galleryToggleBtn) {
        galleryToggleBtn.addEventListener('click', function () {
            var wrapper = document.getElementById('galleryCollapseWrapper');
            var icon = document.getElementById('galleryToggleIcon');
            if (!wrapper) return;

            var isVisible = wrapper.style.display !== 'none';
            if (isVisible) {
                wrapper.style.display = 'none';
                if (icon) {
                    icon.classList.remove('fa-chevron-up');
                    icon.classList.add('fa-chevron-down');
                }
            } else {
                wrapper.style.display = 'block';
                if (icon) {
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-up');
                }
            }
        });
    }
});

// Toggle edit mode
function toggleEditMode() {
    var editSection = document.getElementById('editProjectSection');
    var detailsGrid = document.getElementById('projectDetailsGrid');
    var descSection = document.getElementById('projectDescriptionSection');
    var uploadZone = document.getElementById('galleryUploadZone');
    var galleryContainer = document.getElementById('projectGalleryContainer');
    
    // Toggle visibility
    if (editSection.classList.contains('show')) {
        // Exit edit mode â€” rebuild grid so only populated fields show
        editSection.classList.remove('show');
        buildDetailsGrid(currentProjectData);
        descSection.style.display = (currentProjectData.description && currentProjectData.description.trim()) ? 'block' : 'none';
        if (uploadZone) uploadZone.style.display = 'none';
        galleryEditingActive = false;
        if (galleryContainer) galleryContainer.classList.remove('gallery-editing');
    } else {
        // Enter edit mode
        editSection.classList.add('show');
        detailsGrid.style.display = 'none';
        descSection.style.display = 'none';
        if (uploadZone) uploadZone.style.display = 'flex';
        galleryEditingActive = true;
        if (galleryContainer) galleryContainer.classList.add('gallery-editing');
        
        // Populate edit form with current data
        document.getElementById('editProjectName').value = currentProjectData.name || '';
        document.getElementById('editProjectLocation').value = currentProjectData.location || '';
        document.getElementById('editProjectCategory').value = currentProjectData.category || 'first';
        document.getElementById('editProjectStatus').value = currentProjectData.status || '';
        document.getElementById('editProjectClient').value = currentProjectData.client || '';
        document.getElementById('editProjectDuration').value = currentProjectData.duration || '';
        document.getElementById('editProjectArea').value = currentProjectData.area || '';
        document.getElementById('editProjectType').value = currentProjectData.type || '';
        document.getElementById('editProjectDescription').value = currentProjectData.description || '';
    }
}

// Cancel edit mode
function cancelEditMode() {
    document.getElementById('editProjectSection').classList.remove('show');
    // Rebuild grid dynamically so only populated fields show
    buildDetailsGrid(currentProjectData);
    var descSection = document.getElementById('projectDescriptionSection');
    descSection.style.display = (currentProjectData && currentProjectData.description && currentProjectData.description.trim()) ? 'block' : 'none';
    var uploadZone = document.getElementById('galleryUploadZone');
    var galleryContainer = document.getElementById('projectGalleryContainer');
    if (uploadZone) uploadZone.style.display = 'none';
    galleryEditingActive = false;
    if (galleryContainer) galleryContainer.classList.remove('gallery-editing');
}

// Handle edit form submission
document.addEventListener('DOMContentLoaded', function() {
    var editForm = document.getElementById('editProjectForm');
    if (editForm) {
        editForm.onsubmit = function(e) {
            e.preventDefault();
            
            if (!isAdminLoggedIn()) {
                alert('Please login as admin to edit projects.');
                return;
            }
            
            // Get form data
            var updatedData = {
                id: currentProjectData.id,
                folderName: currentProjectData.folderName,
                name: document.getElementById('editProjectName').value,
                location: document.getElementById('editProjectLocation').value,
                category: document.getElementById('editProjectCategory').value,
                status: document.getElementById('editProjectStatus').value,
                client: document.getElementById('editProjectClient').value,
                duration: document.getElementById('editProjectDuration').value,
                area: document.getElementById('editProjectArea').value,
                type: document.getElementById('editProjectType').value,
                description: document.getElementById('editProjectDescription').value
            };
            
            // Save to localStorage (for static projects) or API (for dynamic projects)
            saveProjectData(updatedData);
        };
    }
});

// Save project data
function saveProjectData(projectData) {
    // Update current project data
    currentProjectData = projectData;
    
    // Update display in the modal
    document.getElementById('projectModalTitle').textContent = projectData.name;
    document.getElementById('projectModalDescription').textContent = projectData.description;
    
    // Rebuild the dynamic details grid from the updated data
    buildDetailsGrid(projectData);
    
    // Update category badge
    var categoryEl = document.getElementById('projectModalCategory');
    var categoryText = projectData.category === 'first' ? 'Complete' : 'Running';
    categoryEl.textContent = categoryText;
    categoryEl.style.backgroundColor = projectData.category === 'first' ? '#28a745' : '#fdbe33';
    
    // Show/hide description section
    var descSection = document.getElementById('projectDescriptionSection');
    if (projectData.description && projectData.description.trim()) {
        descSection.style.display = 'block';
    } else {
        descSection.style.display = 'none';
    }
    
    // Save to localStorage
    var staticProjects = JSON.parse(localStorage.getItem('staticProjects') || '{}');
    staticProjects[projectData.folderName] = projectData;
    localStorage.setItem('staticProjects', JSON.stringify(staticProjects));
    
    // Save to API
    if (projectData.id) {
        fetch('/api/projects/' + projectData.id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectData)
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            console.log('Project updated via API:', data);
            // Also update the portfolio card on the page
            updatePortfolioCard(projectData);
        })
        .catch(function(error) {
            console.log('API not available, saved to localStorage only');
        });
    } else {
        // Update card in DOM even without API
        updatePortfolioCard(projectData);
    }
    
    // Exit edit mode
    cancelEditMode();
    
    alert('Project updated successfully!');
}

// Update the matching portfolio card in the DOM after editing
function updatePortfolioCard(projectData) {
    var cards = document.querySelectorAll('.portfolio-item');
    cards.forEach(function(card) {
        if (card.getAttribute('data-folder') === projectData.folderName) {
            // Update title
            var h3 = card.querySelector('.portfolio-text h3');
            if (h3) h3.textContent = projectData.name;

            // Update overlay description
            var overlayP = card.querySelector('.portfolio-overlay p');
            if (overlayP) {
                var desc = projectData.description || '';
                overlayP.textContent = desc.length > 100 ? desc.substring(0, 100) + '...' : desc;
            }

            // Update category class
            card.className = card.className.replace(/\b(first|second)\b/g, '').trim();
            card.classList.add(projectData.category || 'first');
        }
    });
}

// Confirm delete project
var projectToDelete = null;

function confirmDeleteProject() {
    if (!isAdminLoggedIn()) {
        alert('Please login as admin to delete projects.');
        return;
    }
    
    projectToDelete = currentProjectData;
    var deleteModal = document.getElementById('deleteConfirmModal');
    var deleteMessage = document.getElementById('deleteConfirmMessage');
    
    deleteMessage.innerHTML = 'Are you sure you want to delete <strong>' + currentProjectData.name + '</strong>?<br><br>This will delete:<br>â€¢ Project data<br>â€¢ All images in <code>img/' + currentProjectData.folderName + '/</code><br><br>This action cannot be undone!';
    
    deleteModal.style.display = 'block';
}

// Close delete confirmation
function closeDeleteConfirm() {
    document.getElementById('deleteConfirmModal').style.display = 'none';
    projectToDelete = null;
}

// Set up delete confirmation modal event listeners
document.addEventListener('DOMContentLoaded', function() {
    var deleteModal = document.getElementById('deleteConfirmModal');
    if (deleteModal) {
        // Close when clicking outside
        deleteModal.addEventListener('click', function(event) {
            if (event.target === deleteModal) {
                closeDeleteConfirm();
            }
        });
    }
});

// Delete project
function deleteProject() {
    if (!projectToDelete) return;
    
    var folderName = projectToDelete.folderName;
    var projectId = projectToDelete.id;
    var projectName = projectToDelete.name;
    
    // Remove from localStorage
    var staticProjects = JSON.parse(localStorage.getItem('staticProjects') || '{}');
    delete staticProjects[folderName];
    localStorage.setItem('staticProjects', JSON.stringify(staticProjects));

    // Remove the portfolio card from the DOM so it doesn't reappear on reload
    removePortfolioCard(folderName);

    // Delete via folder-based endpoint (works for both static & dynamic projects)
    fetch('/api/projects/folder/' + encodeURIComponent(folderName), {
        method: 'DELETE'
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        console.log('Project folder deleted via API:', data);
    })
    .catch(function(error) {
        console.log('API folder delete not available:', error);
    });

    // Also try id-based delete if it has one
    if (projectId) {
        fetch('/api/projects/' + projectId, { method: 'DELETE' })
            .then(function(r) { return r.json(); })
            .catch(function() {});
    }

    closeDeleteConfirm();
    closeProjectModal();
    alert('Project "' + projectName + '" deleted successfully!');

    // Reload cards dynamically
    setTimeout(function () {
        if (typeof reloadPortfolioCards === 'function') {
            reloadPortfolioCards();
        }
    }, 500);
}

// Remove a portfolio card from the DOM by matching its data-folder attribute or onclick content
function removePortfolioCard(folderName) {
    var cards = document.querySelectorAll('.portfolio-item');
    cards.forEach(function(card) {
        // Match by data-folder attribute (dynamic cards) or onclick content (legacy)
        var matchByAttr = card.getAttribute('data-folder') === folderName;
        var matchByHtml = !matchByAttr && (card.innerHTML.indexOf("'" + folderName + "'") !== -1 || card.innerHTML.indexOf('"' + folderName + '"') !== -1);

        if (matchByAttr || matchByHtml) {
            card.style.transition = 'opacity 0.4s, transform 0.4s';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.8)';
            setTimeout(function() {
                if (card.parentNode) card.parentNode.removeChild(card);
                if (typeof $ !== 'undefined' && $.fn.isotope) {
                    $('.portfolio-container').isotope('reloadItems').isotope();
                }
            }, 400);
        }
    });
}

// Update admin features visibility (handles both static and dynamic cards)
function updateAdminFeatures() {
    var addProjectBtn = document.getElementById("addProjectBtn");
    var deleteButtons = document.querySelectorAll(".portfolio-delete-btn");
    
    if (isAdminLoggedIn()) {
        if (addProjectBtn) addProjectBtn.style.display = "inline-block";
        deleteButtons.forEach(function(btn) {
            btn.classList.add("show");
            btn.style.display = "flex";
        });
    } else {
        if (addProjectBtn) addProjectBtn.style.display = "none";
        deleteButtons.forEach(function(btn) {
            btn.classList.remove("show");
            btn.style.display = "none";
        });
    }
}

// Load saved project data from localStorage
function loadProjectData(folderName) {
    var staticProjects = JSON.parse(localStorage.getItem('staticProjects') || '{}');
    return staticProjects[folderName] || null;
}

// Open project modal with enhanced data loading
function openProjectModalWithData(folderName, defaultName, defaultDescription, defaultCategory) {
    // Try to load saved data first
    var savedData = loadProjectData(folderName);
    
    if (savedData) {
        // Use saved data
        openProjectModal(
            folderName,
            savedData.name,
            savedData.description,
            savedData.category,
            savedData
        );
    } else {
        // Use default data
        var projectData = {
            folderName: folderName,
            name: defaultName,
            description: defaultDescription,
            category: defaultCategory,
            location: '',
            status: '',
            client: '',
            duration: '',
            area: '',
            type: ''
        };
        openProjectModal(folderName, defaultName, defaultDescription, defaultCategory, projectData);
    }
}

// Quick delete from portfolio card (admin only)
function quickDeleteProject(folderName, projectName) {
    if (!isAdminLoggedIn()) {
        alert('Please login as admin to delete projects.');
        return false;
    }
    
    if (!confirm('Delete "' + projectName + '"?\n\nThis will permanently remove the project and all its images.')) {
        return false;
    }
    
    // Remove from localStorage
    var staticProjects = JSON.parse(localStorage.getItem('staticProjects') || '{}');
    delete staticProjects[folderName];
    localStorage.setItem('staticProjects', JSON.stringify(staticProjects));

    // Remove card from DOM
    removePortfolioCard(folderName);

    // Delete folder via API
    fetch('/api/projects/folder/' + encodeURIComponent(folderName), {
        method: 'DELETE'
    })
    .then(function(r) { return r.json(); })
    .then(function(data) { console.log('Folder deleted:', data); })
    .catch(function(err) { console.log('API not available:', err); });

    alert('Project "' + projectName + '" deleted!');

    // Reload cards dynamically after short delay
    setTimeout(function () {
        if (typeof reloadPortfolioCards === 'function') {
            reloadPortfolioCards();
        }
    }, 500);

    return false;
}

// Initialize delete buttons on page load
document.addEventListener('DOMContentLoaded', function() {
    // Update admin features
    if (typeof updateAdminFeatures === 'function') {
        updateAdminFeatures();
    }
});

