# Deployment Architecture & Setup Guide

## Overview
This document explains the CI/CD pipeline and server setup for deploying the Node.js/Express backend to a Ubuntu VPS using GitHub Actions and PM2.

## What Was Configured

### 1. GitHub Actions Workflows
- **`.github/workflows/deploy.yml`**: Deploys to VPS on every push to `main` branch
  - Checks out code
  - Sets up Node.js 20
  - Installs dependencies with `npm ci`
  - Deploys via SSH to VPS
  - Uses PM2 to manage the application process
  - Includes zero-downtime deployment by restarting existing PM2 process

- **`.github/workflows/ci.yml`**: Continuous Integration workflow
  - Runs on push to main/develop and pull requests
  - Sets up Node.js 20
  - Installs dependencies
  - Placeholder for running tests and linting (uncomment as needed)

### 2. Deployment Script
- **`scripts/deploy.sh`**: Bash script that performs the deployment steps
  - Can be used manually or by the GitHub Actions workflow
  - Includes error handling and status reporting

### 3. PM2 Process Management
- The application is managed by PM2 for:
  - Automatic restart on crash
  - Automatic restart on system reboot (via `pm2 save` and startup script)
  - Zero-downtime deployments
  - Easy logging and monitoring

## Required GitHub Secrets

Add these secrets in your GitHub repository settings (Settings > Secrets and variables > Actions):

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `SSH_PRIVATE_KEY` | Private SSH key for accessing the VPS (must correspond to a public key in `~/.ssh/authorized_keys` on the server) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `SERVER_USER` | Username for SSH connection to VPS | `deploy` or `root` |
| `SERVER_HOST` | IP address or hostname of your VPS | `123.45.67.89` |
| `SERVER_PORT` | SSH port of your VPS (default is 22) | `22` |
| `APP_PATH` | Absolute path to the application directory on the VPS | `/home/deploy/app` |
| `PM2_PROCESS_NAME` | Name of the PM2 process for your application | `cse-icb-department-server` |

## Server Setup Instructions

Follow these steps on your Ubuntu VPS to prepare for deployment:

### 1. Initial Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Create a deploy user (recommended over using root)
sudo adduser deploy
sudo usermod -aG sudo deploy

# Switch to deploy user
su - deploy
```

### 2. Install Node.js and PM2
```bash
# Install Node.js 20 LTS (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should be v20.x
npm --version

# Install PM2 globally
sudo npm install -g pm2

# Set up PM2 to start on boot
pm2 startup
# Follow the instructions output by the command (usually involves running a sudo command)
```

### 3. Prepare Application Directory
```bash
# Create application directory (match APP_PATH secret)
mkdir -p /home/deploy/app
cd /home/deploy/app

# Initialize git repository (if not already done)
git init

# Set up remote (replace with your actual repository URL)
git remote add origin https://github.com/yourusername/your-repo.git
# Or for SSH:
# git remote add origin git@github.com:yourusername/your-repo.git

# Pull initial code
git fetch origin
git checkout main

# Install dependencies
npm ci --production

# Create .env file (copy from your local environment or set up manually)
# Never commit this file - it's already in .gitignore
cp .env.example .env  # If you have an example
# Or create manually:
# nano .env
```

### 4. Configure Environment Variables
Create a `.env` file in your application directory with the required variables:
```
NODE_ENV=production
PORT=3000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
# Add other required variables from your current .env file
```

### 5. Start Application with PM2
```bash
# Start the application and save the process list
pm2 start server.js --name "cse-icb-department-server"
pm2 save

# Verify it's running
pm2 list
pm2 show cse-icb-department-server
```

### 6. Optional: Set Up Nginx as Reverse Proxy (Recommended for Production)
```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration for your app
sudo nano /etc/nginx/sites-available/app
```

Add the following configuration (adjust port and domain as needed):
```
server {
    listen 80;
    server_name your-domain.com;  # or your VPS IP if no domain

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/app /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

### 7. Optional: Set Up SSL with Let's Encrypt (If using a domain)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
# Follow the prompts to configure SSL
```

## Verification Steps

### 1. Verify GitHub Actions Workflow
- Make a push to your `main` branch
- Go to the Actions tab in your GitHub repository
- Verify that the "Deploy to VPS" workflow runs successfully
- Check the workflow logs for any errors

### 2. Verify Deployment on Server
```bash
# Check that the application is running
pm2 list

# Check application logs
pm2 logs cse-icb-department-server

# Verify the code is up to date
cd /home/deploy/app
git log -1  # Compare with your latest commit

# Test the application (if using Nginx)
curl -I http://localhost:3000  # Should return 200 OK
# Or through Nginx
curl -I http://your-domain.com  # Should return 200 OK
```

### 3. Test Zero-Downtime Deployment
1. Make a small change to your code (e.g., update a comment in server.js)
2. Commit and push to main
3. Watch the deployment logs in GitHub Actions
4. Verify on the server that the application restarts without dropping connections
   - You can use `pm2 logs` to see the restart
   - Make requests during deployment to verify they succeed

### 4. Test Rollback Safety
The deployment uses `git reset --hard origin/main` which will always deploy the exact code from the main branch.
To test rollback:
1. Push a bad commit to main
2. Observe that the deployment fails (if you have tests in CI) or deploys the bad code
3. Fix the code and push again - the next deployment will automatically deploy the fixed code
4. For immediate rollback to previous known good state, you can:
   ```bash
   # On the server
   cd /home/deploy/app
   git reset --hard <previous-good-commit>
   pm2 restart cse-icb-department-server
   ```

## Security Recommendations

1. **SSH Key Security**
   - Use a dedicated deploy key with limited permissions
   - Never share your SSH private key
   - Consider using SSH agent forwarding or deploy keys with restricted commands

2. **GitHub Secrets**
   - Rotate secrets periodically
   - Limit secret access to only required workflows
   - Use environment protection rules if needed

3. **Server Security**
   - Keep Ubuntu updated: `sudo apt update && sudo apt upgrade -y`
   - Configure UFW firewall: 
     ```bash
     sudo ufw allow OpenSSH
     sudo ufw allow 'Nginx Full'  # If using Nginx
     sudo ufw enable
     ```
   - Fail2ban for SSH protection: `sudo apt install -y fail2ban`
   - Regular security audits with tools like lynis

4. **Application Security**
   - Keep dependencies updated: `npm outdated` and `npm update`
   - Use npm audit to check for vulnerabilities
   - Implement proper input validation and sanitization in your code
   - Use HTTPS in production (via Let's Encrypt as shown above)

## Future Scaling Recommendations

1. **Horizontal Scaling**
   - Use a process manager like PM2 to run multiple instances:
     ```bash
     pm2 scale cse-icb-department-server 4  # Runs 4 instances
     ```
   - Put a load balancer (like Nginx) in front to distribute traffic

2. **Database Optimization**
   - Consider using MongoDB Atlas or a managed database service
   - Implement connection pooling
   - Add read replicas for read-heavy workloads

3. **Caching**
   - Add Redis for caching frequently accessed data
   - Use PM2's built-in clustering for Node.js clustering

4. **Monitoring and Logging**
   - Implement centralized logging (ELK stack, Datadog, etc.)
   - Add application performance monitoring (APM) with tools like New Relic or AppSignal
   - Use PM2's monitoring: `pm2 monit`

5. **Containerization (Alternative)**
   - Consider moving to Docker for more consistent deployments
   - Use Docker Compose or Kubernetes for orchestration
   - This would require updating the GitHub Actions workflow to build and push Docker images

## Backup and Recovery Recommendations

1. **Application Code**
   - Your code is already backed up in GitHub
   - Regularly push to remote: `git push origin main`

2. **Environment Configuration**
   - Back up your `.env` file securely (encrypted storage, password manager)
   - Consider storing encrypted backups in a secure location

3. **Database**
   - Set up regular MongoDB backups:
     ```bash
     # Using mongodump
     mongodump --uri="your_mongodb_uri" --out=/path/to/backup/$(date +%Y-%m-%d)
     ```
   - Automate with cron jobs
   - Test restore procedures regularly

4. **Server Snapshots**
   - If using a cloud provider, take regular snapshots of your VPS
   - Before major updates, create a snapshot for quick rollback

5. **Disaster Recovery Documentation**
   - Keep this deployment guide updated
   - Document any custom configurations or manual steps
   - Store recovery procedures in a secure, accessible location

## Files Created/Updated

1. `.github/workflows/deploy.yml` - Deployment workflow
2. `.github/workflows/ci.yml` - CI workflow
3. `scripts/deploy.sh` - Deployment script
4. `docs/deployment.md` - This documentation file

## Next Steps

1. Set up the GitHub Secrets as described above
2. Prepare your VPS following the server setup instructions
3. Make a test push to your `main` branch to verify the pipeline works
4. Monitor the first deployment and verify the application is running correctly
5. Consider adding tests and enabling the test steps in the CI workflow
6. Optional: Set up Nginx and SSL for production-grade security and performance

```

Note: Replace placeholder values (like `your-domain.com`, `your-mongodb-uri`, etc.) with your actual values.