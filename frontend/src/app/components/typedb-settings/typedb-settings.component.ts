import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TypeDBConnectionService } from '../../services/typedb-connection.service';
import { TypeDBConnectionConfig, DEFAULT_CONFIG } from '../../models/typedb-config.models';

@Component({
  selector: 'app-typedb-settings',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './typedb-settings.component.html',
  styleUrl: './typedb-settings.component.css',
})
export class TypeDBSettingsComponent implements OnInit {
  private readonly connectionService = inject(TypeDBConnectionService);
  private readonly fb = inject(FormBuilder);

  protected readonly connectionForm = this.fb.group({
    address: [DEFAULT_CONFIG.address, Validators.required],
    database: [DEFAULT_CONFIG.database, Validators.required],
    username: [DEFAULT_CONFIG.username, Validators.required],
    password: ['', Validators.required],
    tlsEnabled: [DEFAULT_CONFIG.tlsEnabled],
  });

  protected readonly testing = signal(false);
  protected readonly connecting = signal(false);
  protected readonly testResult = signal<{ success: boolean; message: string } | null>(null);

  protected readonly connectionStatus = this.connectionService.connectionStatus;

  ngOnInit(): void {
    const prefs = this.connectionService.loadConnectionPreferences();
    if (prefs) {
      this.connectionForm.patchValue(prefs);
    }
  }

  async onTestConnection(): Promise<void> {
    if (this.connectionForm.invalid) return;

    this.testing.set(true);
    this.testResult.set(null);

    const config = this.connectionForm.value as TypeDBConnectionConfig;

    try {
      await this.connectionService.connect(config);
      await this.connectionService.disconnect();

      this.testResult.set({
        success: true,
        message: 'Connection successful!',
      });
    } catch (error) {
      this.testResult.set({
        success: false,
        message: `Connection failed: ${(error as Error).message}`,
      });
    } finally {
      this.testing.set(false);
    }
  }

  async onConnect(): Promise<void> {
    if (this.connectionForm.invalid) return;

    this.connecting.set(true);
    const config = this.connectionForm.value as TypeDBConnectionConfig;

    try {
      await this.connectionService.connect(config);
    } catch (error) {
      console.error('Connection error:', error);
    } finally {
      this.connecting.set(false);
    }
  }

  async onDisconnect(): Promise<void> {
    await this.connectionService.disconnect();
  }

  onUseCloudDefaults(): void {
    this.connectionForm.patchValue({
      address: 'https://n69m16-0.cluster.typedb.com:80',
      database: 'sam-hackathon',
      username: 'admin',
      tlsEnabled: true,
    });
  }

  onUseLocalDefaults(): void {
    this.connectionForm.patchValue({
      address: 'localhost:1729',
      database: 'dnd',
      username: 'admin',
      tlsEnabled: false,
    });
  }
}
