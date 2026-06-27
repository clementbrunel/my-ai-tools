#!/usr/bin/env python3
"""
Claude to Mistral Configuration Migration Tool
Migrates Claude configuration, MCPs, and Skills to Mistral equivalent format
"""

import json
import yaml
import os
import shutil
from pathlib import Path
from typing import Dict, Any, List
import datetime

class ClaudeToMistralMigrator:
    def __init__(self):
        self.claude_config_path = Path.home() / ".claude.json"
        self.mistral_config_dir = Path.home() / ".mistral"
        self.backup_dir = self.mistral_config_dir / "backups"
        
    def backup_existing(self):
        """Backup existing Mistral config if it exists"""
        if self.mistral_config_dir.exists():
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = self.backup_dir / f"mistral_backup_{timestamp}"
            shutil.copytree(self.mistral_config_dir, backup_path)
            print(f"✓ Backed up existing Mistral config to {backup_path}")
        
    def migrate_claude_config(self):
        """Migrate main Claude config to Mistral format"""
        if not self.claude_config_path.exists():
            print("✗ Claude config not found at", self.claude_config_path)
            return False
            
        with open(self.claude_config_path, 'r', encoding='utf-8') as f:
            claude_config = json.load(f)
        
        # Create Mistral equivalent structure
        mistral_config = {
            'version': '1.0',
            'migration_source': 'claude',
            'migration_date': datetime.datetime.now().isoformat(),
            'settings': {
                'general': {
                    'user_id': claude_config.get('userID'),
                    'first_start': claude_config.get('firstStartTime'),
                },
                'features': {}
            },
            'skills': {},
            'contexts': {},
            'mcps': {}
        }
        
        # Migrate cachedGrowthBookFeatures to Mistral features
        if 'cachedGrowthBookFeatures' in claude_config:
            for feature, value in claude_config['cachedGrowthBookFeatures'].items():
                if isinstance(value, dict):
                    mistral_config['settings']['features'][feature] = value
                else:
                    mistral_config['settings']['features'][feature] = {'enabled': bool(value)}
        
        # Save Mistral config
        self.mistral_config_dir.mkdir(exist_ok=True)
        config_file = self.mistral_config_dir / "config.yaml"
        
        with open(config_file, 'w', encoding='utf-8') as f:
            yaml.dump(mistral_config, f, sort_keys=False)
        
        print(f"✓ Migrated Claude config to {config_file}")
        return True
    
    def migrate_mcp_servers(self, claude_config: Dict[str, Any]):
        """Migrate MCP server configurations"""
        mcps_config = {}
        
        # Extract MCP server info from projects
        if 'projects' in claude_config:
            for project_path, project_data in claude_config['projects'].items():
                if 'mcpServers' in project_data:
                    for server_name, server_config in project_data['mcpServers'].items():
                        mcps_config[server_name] = {
                            'type': 'mcp',
                            'source': 'claude_projects',
                            'project': project_path,
                            'config': server_config
                        }
        
        # Extract harbor configuration
        if 'tengu_harbor_ledger' in claude_config.get('cachedGrowthBookFeatures', {}):
            harbor_config = claude_config['cachedGrowthBookFeatures']['tengu_harbor_ledger']
            if isinstance(harbor_config, list):
                for entry in harbor_config:
                    plugin_id = f"{entry['marketplace']}_{entry['plugin']}"
                    mcps_config[plugin_id] = {
                        'type': 'harbor_plugin',
                        'marketplace': entry['marketplace'],
                        'plugin': entry['plugin']
                    }
        
        if mcps_config:
            mcps_file = self.mistral_config_dir / "mcps.yaml"
            with open(mcps_file, 'w', encoding='utf-8') as f:
                yaml.dump({'mcps': mcps_config}, f, sort_keys=False)
            print(f"✓ Migrated {len(mcps_config)} MCP servers to {mcps_file}")
        
        return mcps_config
    
    def migrate_skills(self, claude_config: Dict[str, Any]):
        """Migrate Claude skills to Mistral skills format"""
        skills_config = {}
        
        # Extract skills from amber_lattice
        if 'tengu_amber_lattice' in claude_config.get('cachedGrowthBookFeatures', {}):
            lattice_config = claude_config['cachedGrowthBookFeatures']['tengu_amber_lattice']
            if 'plugins' in lattice_config:
                for skill_name in lattice_config['plugins']:
                    skills_config[skill_name] = {
                        'type': 'skill',
                        'source': 'claude_amber_lattice',
                        'enabled': True,
                        'description': f'Migrated from Claude skill: {skill_name}'
                    }
        
        if skills_config:
            skills_file = self.mistral_config_dir / "skills.yaml"
            with open(skills_file, 'w', encoding='utf-8') as f:
                yaml.dump({'skills': skills_config}, f, sort_keys=False)
            print(f"✓ Migrated {len(skills_config)} skills to {skills_file}")
        
        return skills_config
    
    def create_migration_report(self, claude_config: Dict[str, Any], 
                               mcps_count: int, skills_count: int):
        """Create a migration report"""
        report = {
            'migration_summary': {
                'source': 'claude',
                'date': datetime.datetime.now().isoformat(),
                'claude_config_path': str(self.claude_config_path),
                'mistral_config_dir': str(self.mistral_config_dir),
                'statistics': {
                    'mcp_servers_migrated': mcps_count,
                    'skills_migrated': skills_count,
                    'feature_flags_migrated': len(claude_config.get('cachedGrowthBookFeatures', {}))
                }
            },
            'important_notes': [
                'This migration preserves configuration structure but may need manual review',
                'Some Claude-specific features may not have direct Mistral equivalents',
                'Review the migrated files before using in production'
            ],
            'files_created': [
                str(self.mistral_config_dir / "config.yaml"),
                str(self.mistral_config_dir / "mcps.yaml"),
                str(self.mistral_config_dir / "skills.yaml")
            ]
        }
        
        report_file = self.mistral_config_dir / "migration_report.yaml"
        with open(report_file, 'w', encoding='utf-8') as f:
            yaml.dump(report, f, sort_keys=False)
        
        print(f"✓ Created migration report at {report_file}")
    
    def run_migration(self):
        """Run the complete migration process"""
        print("🚀 Starting Claude to Mistral migration...")
        print(f"📁 Source: {self.claude_config_path}")
        print(f"📁 Target: {self.mistral_config_dir}")
        
        # Load Claude config
        if not self.claude_config_path.exists():
            print("❌ Claude configuration not found!")
            return False
            
        with open(self.claude_config_path, 'r', encoding='utf-8') as f:
            claude_config = json.load(f)
        
        # Backup existing Mistral config
        self.backup_existing()
        
        # Perform migrations
        self.migrate_claude_config()
        mcps_count = len(self.migrate_mcp_servers(claude_config))
        skills_count = len(self.migrate_skills(claude_config))
        
        # Create report
        self.create_migration_report(claude_config, mcps_count, skills_count)
        
        print("\n🎉 Migration completed successfully!")
        print(f"📋 Summary:")
        print(f"   • {mcps_count} MCP servers migrated")
        print(f"   • {skills_count} skills migrated")
        print(f"   • {len(claude_config.get('cachedGrowthBookFeatures', {}))} feature flags migrated")
        print(f"\n📖 Review the migration report at: {self.mistral_config_dir / 'migration_report.yaml'}")
        
        return True

if __name__ == "__main__":
    migrator = ClaudeToMistralMigrator()
    migrator.run_migration()