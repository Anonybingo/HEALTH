// EmailJS setup - replace with your actual IDs from EmailJS dashboard
const EMAILJS_PUBLIC_KEY = 'mc8jVgUOg3D0TORvg';  // Your Public Key (from Account > API Keys)
const EMAILJS_TEMPLATE_ID = 'template_zszv3b3';  // Your Template ID (from the Contact Us template)
const EMAILJS_SERVICE_ID = 'service_xifldva';  // Your Service ID (from Email Services)

// Load EmailJS script dynamically (or add <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script> to your <head> instead)
(function() {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    script.onload = initEmailJS;
    document.head.appendChild(script);
})();

function initEmailJS() {
    emailjs.init(EMAILJS_PUBLIC_KEY);
}

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('contactForm');
    const statusDiv = document.getElementById('formStatus');

    if (!form || !statusDiv) {
        console.error('Form or status div not found!');
        return;
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();  // Prevent page reload

        // Client-side validation (builds on HTML 'required')
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const message = document.getElementById('message').value.trim();
        // const image_url = "https://i.imgur.com/RDVuvNw.png";

        if (!name || !email || !message) {
            showStatus('Please fill in all required fields (name, email, message).', 'error');
            return;
        }

        if (!isValidEmail(email)) {
            showStatus('Please enter a valid email address.', 'error');
            return;
        }

        // Collect form data - matches your template variables (e.g., {{name}}, {{email}})
        const formData = {
            name: `${name}`,  // For {{name}} in template
            email: email,
            phone: document.getElementById('phone').value.trim() || 'Not provided',
            // company: document.getElementById('company').value.trim() || 'Not provided',
            // service: document.querySelector('#service .selected-value')?.textContent || 'Not selected',
            message: message,
            time: new Date().toLocaleString()  // Adds timestamp like "10/28/2025, 3:45:12 PM"
        };

        // Show loading state
        showStatus('Sending your message...', 'loading');
        form.querySelector('button[type="submit"]').disabled = true;  // Disable button during send

        try {
            // Send via EmailJS
            const response = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, formData);
            
            if (response.status === 200) {
                showStatus('Thanks! Your message has been sent. We\'ll get back to you soon.', 'success');
                form.reset();  // Clear all fields
            } else {
                throw new Error(`Unexpected status: ${response.status}`);
            }
        } catch (error) {
            console.error('EmailJS error:', error);
            showStatus('Oops! Something went wrong sending the message. Try again or email us directly at ndayizejanson15@gmail.com.', 'error');
        } finally {
            form.querySelector('button[type="submit"]').disabled = false;  // Re-enable button
        }
    });

    // Helper: Basic email validation regex
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    // Helper: Display status messages with styling
    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status-${type}`;  // Assumes CSS classes like .status-success { color: green; }
        statusDiv.style.display = 'block';
        statusDiv.style.color = '#fff';
        
        // Auto-hide success/loading after 5s; keep errors visible
        if (type !== 'error') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
                statusDiv.className = '';
            }, 5000);
        }
    }
});