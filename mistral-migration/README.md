# Claude to Mistral Migration Tool

## Overview

This tool migrates Claude AI configuration, MCPs (Machine Communication Protocols), and Skills to Mistral AI equivalent format. It's designed to help users transition from Claude to Mistral while preserving their configuration structure.

## Features

- **Configuration Migration**: Converts Claude's `.claude.json` to Mistral's YAML format
- **MCP Server Migration**: Extracts and converts MCP server configurations
- **Skills Migration**: Migrates Claude skills/plugins to Mistral skills format
- **Automatic Backup**: Creates backups of existing Mistral configurations
- **Migration Reporting**: Generates detailed migration reports

## Installation

### Prerequisites

- Python 3.7+
- PyYAML package

```bash
pip install pyyaml
```

## Usage

### Basic Migration

```bash
cd mistral-migration
python migrate_claude_to_mistral.py
```

### What Gets Migrated

1. **Main Configuration**: `.claude.json` → `~/.mistral/config.yaml`
2. **MCP Servers**: Project MCPs and Harbor plugins → `~/.mistral/mcps.yaml`
3. **Skills**: Claude plugins/skills → `~/.mistral/skills.yaml`
4. **Feature Flags**: GrowthBook features → Mistral feature settings

## Migration Details

### Configuration Structure

**Claude Source:**
```json
{
  "cachedGrowthBookFeatures": {
    "tengu_feature_name": { ... }
  },
  "projects": {
    "project_path": {
      "mcpServers": { ... }
    }
  }
}
```

**Mistral Target:**
```yaml
version: '1.0'
migration_source: 'claude'
settings:
  general:
    user_id: "..."
    first_start: "..."
  features:
    tengu_feature_name:
      enabled: true
      # ... other settings
mcps:
  server_name:
    type: 'mcp'
    source: 'claude_projects'
    # ... server config
skills:
  skill_name:
    type: 'skill'
    source: 'claude_amber_lattice'
    enabled: true
```

## Output Files

The migration creates these files in `~/.mistral/`:

- `config.yaml` - Main Mistral configuration
- `mcps.yaml` - MCP server configurations  
- `skills.yaml` - Migrated skills
- `migration_report.yaml` - Detailed migration report
- `backups/` - Backup of any existing Mistral config

## Important Notes

1. **Review Before Use**: Always review migrated configurations before production use
2. **Feature Parity**: Some Claude-specific features may not have direct Mistral equivalents
3. **Manual Adjustment**: You may need to manually adjust some settings post-migration
4. **Backup Safety**: Existing Mistral configs are automatically backed up

## Development

### Testing

To test the migration tool:

```bash
# Create a test Claude config
cp ~/.claude.json ~/.claude.json.test

# Run migration
python migrate_claude_to_mistral.py

# Review output
cat ~/.mistral/migration_report.yaml
```

### Extending

To add support for additional Claude features:

1. Identify the feature in Claude's JSON structure
2. Add migration logic in the appropriate method
3. Update the migration report to track the new feature
4. Test with sample data

## License

MIT License - Free to use and modify for personal and commercial projects.

## Support

For issues or questions, please refer to the Mistral AI documentation or create an issue in the repository.

---

*Migration tool created for seamless transition from Claude to Mistral AI configurations.*