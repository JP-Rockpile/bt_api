# Contributing to Bet Think API

Thank you for your interest in contributing to Bet Think API! This document provides guidelines and instructions for contributing.

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- Git
- PostgreSQL knowledge
- TypeScript/NestJS experience

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/bt_api.git
   cd bt_api
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start Development Stack**
   ```bash
   docker-compose up -d postgres redis
   npm run prisma:migrate
   npm run db:seed
   npm run start:dev
   ```

## 📝 Code Standards

### TypeScript Style Guide

- Use TypeScript strict mode
- Prefer interfaces over type aliases for object shapes
- Use explicit return types for public methods
- Avoid `any` type - use `unknown` if type is truly unknown

### NestJS Conventions

- **Controllers**: Handle HTTP requests, minimal business logic
- **Services**: Contain business logic, injected into controllers
- **DTOs**: Use `class-validator` decorators for validation
- **Modules**: Organize features, export necessary providers

### File Naming

- Controllers: `*.controller.ts`
- Services: `*.service.ts`
- DTOs: `*.dto.ts`
- Modules: `*.module.ts`
- Tests: `*.spec.ts` (unit), `*.e2e-spec.ts` (e2e)

### Code Formatting

```bash
# Format code
npm run format

# Lint
npm run lint

# Fix linting issues
npm run lint -- --fix
```

## 🧪 Testing

### Writing Tests

- Write unit tests for all services
- Write integration tests for critical workflows
- Aim for 80%+ coverage on business logic
- Mock external dependencies (APIs, databases)

### Running Tests

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

### Test Structure

```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let dependency: DependencyMock;

  beforeEach(async () => {
    // Setup test module
  });

  describe('methodName', () => {
    it('should do something', () => {
      // Arrange
      // Act
      // Assert
    });

    it('should handle error case', () => {
      // Test error handling
    });
  });
});
```

## 🔄 Pull Request Process

### Before Submitting

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Write clear, concise commit messages
   - Follow conventional commits format:
     - `feat:` New feature
     - `fix:` Bug fix
     - `docs:` Documentation
     - `refactor:` Code refactoring
     - `test:` Adding tests
     - `chore:` Maintenance tasks

3. **Test Your Changes**
   ```bash
   npm run lint
   npm test
   npm run test:e2e
   ```

4. **Update Documentation**
   - Update README if adding features
   - Add JSDoc comments to public methods
   - Update API documentation if endpoints change

### Submitting PR

1. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create Pull Request**
   - Provide clear title and description
   - Reference related issues
   - Include testing instructions
   - Add screenshots for UI changes (if applicable)

3. **PR Template**
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] Unit tests pass
   - [ ] E2E tests pass
   - [ ] Manual testing completed

   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   - [ ] No breaking changes (or documented)
   ```

### Code Review

- Address all review comments
- Keep PR focused on single feature/fix
- Update PR based on feedback
- Maintain passing CI checks

## 🗄️ Database Changes

### Creating Migrations

```bash
# Create migration
npx prisma migrate dev --name descriptive_name

# Apply migration
npm run prisma:migrate

# Reset database (dev only)
npm run db:reset
```

### Migration Guidelines

- Make migrations backward compatible when possible
- Test migrations on production-like data
- Document breaking changes
- Never delete migrations that have been deployed

## 📦 Adding Dependencies

### Before Adding

- Check if functionality already exists
- Evaluate package maintenance status
- Consider bundle size impact
- Check license compatibility

### Adding Package

```bash
# Production dependency
npm install package-name

# Development dependency
npm install -D package-name
```

### Update Documentation

- Add to README if user-facing
- Document configuration in .env.example
- Add to relevant sections of docs

## 🐛 Reporting Bugs

### Bug Report Template

```markdown
**Describe the bug**
Clear description of the bug

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What should happen

**Actual behavior**
What actually happens

**Environment**
- OS: [e.g. macOS 13]
- Node version: [e.g. 20.10.0]
- Docker version: [if applicable]

**Additional context**
Logs, screenshots, etc.
```

## 💡 Feature Requests

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
Clear description of the problem

**Proposed solution**
How you'd like it to work

**Alternatives considered**
Other solutions you've considered

**Additional context**
Any other relevant information
```

## 🎯 Areas for Contribution

### High Priority

- [ ] Add more odds provider adapters
- [ ] Improve team name fuzzy matching
- [ ] Enhance analytics calculations
- [ ] Add more comprehensive tests
- [ ] Performance optimizations

### Good First Issues

- Documentation improvements
- Adding code comments
- Writing tests for uncovered code
- Fixing minor bugs
- Improving error messages

## 📞 Communication

- **Issues**: Use GitHub Issues for bugs and features
- **Discussions**: Use GitHub Discussions for questions
- **Security**: Email security@betthink.com for vulnerabilities

## 📜 License

By contributing, you agree that your contributions will be licensed under the same license as the project.

## 🙏 Recognition

Contributors will be recognized in our CONTRIBUTORS.md file. Thank you for making Bet Think better!

