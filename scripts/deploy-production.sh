#!/bin/bash

# AutoClaude Production Deployment Script
# This script handles the production deployment process

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
PACKAGE_NAME="autoclaude"
BUILD_DIR="$PROJECT_ROOT/out"
DIST_DIR="$PROJECT_ROOT/dist"
TERMINAL_DIR="$PROJECT_ROOT/terminal"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

check_requirements() {
    log "Checking requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    log "Node.js version: $NODE_VERSION"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
        exit 1
    fi
    
    NPM_VERSION=$(npm -v)
    log "npm version: $NPM_VERSION"
    
    # Check vsce
    if ! command -v vsce &> /dev/null; then
        warning "vsce not found globally, will use local version"
    fi
    
    success "All requirements met"
}

run_tests() {
    log "Running tests..."
    
    cd "$PROJECT_ROOT"
    
    # Run unit tests
    if npm test; then
        success "All tests passed"
    else
        error "Tests failed. Please fix before deploying."
        exit 1
    fi
}

check_production_readiness() {
    log "Checking production readiness..."
    
    # Check for console.log statements
    CONSOLE_LOGS=$(grep -r "console\.log" "$PROJECT_ROOT/src" --include="*.ts" --include="*.js" | grep -v "webview" | wc -l || true)
    if [ "$CONSOLE_LOGS" -gt 0 ]; then
        warning "Found $CONSOLE_LOGS console.log statements in production code"
    fi
    
    # Check for TODO comments
    TODOS=$(grep -r "TODO" "$PROJECT_ROOT/src" --include="*.ts" | wc -l || true)
    if [ "$TODOS" -gt 0 ]; then
        warning "Found $TODOS TODO comments"
    fi
    
    # Check for any types
    ANY_TYPES=$(grep -r ": any" "$PROJECT_ROOT/src" --include="*.ts" | wc -l || true)
    if [ "$ANY_TYPES" -gt 0 ]; then
        warning "Found $ANY_TYPES 'any' types"
    fi
    
    # Check package.json version
    VERSION=$(node -p "require('$PROJECT_ROOT/package.json').version")
    log "Package version: $VERSION"
    
    # Check if .env.example exists
    if [ ! -f "$PROJECT_ROOT/.env.example" ]; then
        error ".env.example not found"
        exit 1
    fi
    
    success "Production readiness check complete"
}

build_extension() {
    log "Building extension..."
    
    cd "$PROJECT_ROOT"
    
    # Clean previous builds
    rm -rf "$BUILD_DIR"
    rm -rf "$DIST_DIR"
    mkdir -p "$DIST_DIR"
    
    # Install dependencies
    log "Installing dependencies..."
    npm ci
    
    # Build TypeScript
    log "Compiling TypeScript..."
    npm run compile:production
    
    # Build terminal package
    if [ -d "$TERMINAL_DIR" ]; then
        log "Building terminal package..."
        cd "$TERMINAL_DIR"
        npm ci
        npm run build
        cd "$PROJECT_ROOT"
    fi
    
    success "Build complete"
}

package_extension() {
    log "Packaging extension..."
    
    cd "$PROJECT_ROOT"
    
    # Package VS Code extension
    npx vsce package --no-dependencies -o "$DIST_DIR/"
    
    # Get the generated vsix file
    VSIX_FILE=$(ls -t "$DIST_DIR"/*.vsix | head -n1)
    
    if [ -z "$VSIX_FILE" ]; then
        error "Failed to create VSIX package"
        exit 1
    fi
    
    log "Created package: $VSIX_FILE"
    
    # Package terminal CLI if exists
    if [ -d "$TERMINAL_DIR" ]; then
        log "Packaging terminal CLI..."
        cd "$TERMINAL_DIR"
        npm pack
        mv *.tgz "$DIST_DIR/"
        cd "$PROJECT_ROOT"
    fi
    
    success "Packaging complete"
}

create_release_notes() {
    log "Creating release notes..."
    
    VERSION=$(node -p "require('$PROJECT_ROOT/package.json').version")
    RELEASE_NOTES="$DIST_DIR/RELEASE_NOTES_v${VERSION}.md"
    
    cat > "$RELEASE_NOTES" << EOF
# Release Notes - AutoClaude v${VERSION}

## Release Date: $(date +'%Y-%m-%d')

## What's New

### Features
- Rate limiting for API protection
- CSRF protection for enhanced security
- Improved error handling
- Production-ready configuration

### Bug Fixes
- Fixed test compilation errors
- Replaced console.log with proper logging
- Updated outdated dependencies

### Improvements
- Better TypeScript type safety
- Enhanced documentation
- Docker support for containerization

## Installation

\`\`\`bash
# Install from VSIX
code --install-extension $VSIX_FILE

# Or install from marketplace
ext install R3ENetwork.autoclaude
\`\`\`

## Configuration

Copy \`.env.example\` to \`.env\` and configure as needed.

## Breaking Changes

None

## Known Issues

- Some TypeScript 'any' types remain (work in progress)
- TODO comments need implementation

## Contributors

Thank you to all contributors who made this release possible!
EOF
    
    success "Release notes created: $RELEASE_NOTES"
}

deploy_checks() {
    log "Running deployment checks..."
    
    # Check if Docker is available
    if command -v docker &> /dev/null; then
        log "Docker available, building image..."
        cd "$PROJECT_ROOT"
        docker build -t autoclaude:latest .
        success "Docker image built"
    else
        warning "Docker not available, skipping container build"
    fi
    
    # Security scan
    log "Running security audit..."
    cd "$PROJECT_ROOT"
    npm audit || warning "Security vulnerabilities found"
    
    success "Deployment checks complete"
}

main() {
    echo "========================================="
    echo "AutoClaude Production Deployment"
    echo "========================================="
    echo
    
    # Parse arguments
    SKIP_TESTS=false
    SKIP_CHECKS=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --skip-checks)
                SKIP_CHECKS=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --skip-tests    Skip running tests"
                echo "  --skip-checks   Skip production readiness checks"
                echo "  --help          Show this help message"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run deployment steps
    check_requirements
    
    if [ "$SKIP_CHECKS" = false ]; then
        check_production_readiness
    fi
    
    if [ "$SKIP_TESTS" = false ]; then
        run_tests
    fi
    
    build_extension
    package_extension
    create_release_notes
    deploy_checks
    
    echo
    success "========================================="
    success "Deployment complete!"
    success "========================================="
    echo
    log "Output files in: $DIST_DIR"
    ls -la "$DIST_DIR"
    echo
    log "Next steps:"
    echo "  1. Test the VSIX package locally"
    echo "  2. Upload to VS Code Marketplace"
    echo "  3. Create GitHub release"
    echo "  4. Deploy Docker image to registry"
}

# Run main function
main "$@"