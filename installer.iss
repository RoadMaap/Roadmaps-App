; ---------------------------------------------------------
; 1. Configuration & Version Extraction
; ---------------------------------------------------------
#define AppName "RoadMaps App"
#define VerFile "backend\build_assets\current_version.txt"
#define FileHandle FileOpen(VerFile)
#define AppVersion Trim(FileRead(FileHandle))
#expr FileClose(FileHandle)
#define AppExeName "Roadmaps App.exe"

[Setup]
; ---------------------------------------------------------
; 2. Application Info
; ---------------------------------------------------------
AppId={{2F1D98B8-4E9A-4C4C-9417-4C0B019A6A7F}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=RoadMaps
AppPublisherURL=https://roadmaps.ir/

; ---------------------------------------------------------
; 3. Installer UI & Images
; ---------------------------------------------------------
DisableWelcomePage=no
WizardImageFile=logoSetup.bmp
WizardImageStretch=yes

; ---------------------------------------------------------
; 4. Installation Directories & Output
; ---------------------------------------------------------
DefaultDirName={autopf}\RoadmapsApp
DefaultGroupName={#AppName}
UninstallDisplayIcon={app}\{#AppExeName}
OutputDir=dist\installer
OutputBaseFilename=RoadmapsApp_Setup

; ---------------------------------------------------------
; 5. System & Behavior Settings
; ---------------------------------------------------------
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
CloseApplications=yes
CloseApplicationsFilter={#AppExeName}
RestartApplications=no
DisableProgramGroupPage=yes

[Messages]
; ---------------------------------------------------------
; 6. Custom Texts
; ---------------------------------------------------------
WelcomeLabel1=Welcome to RoadMaps App
WelcomeLabel2=Your accessible gateway to the financial markets.%n%nIt is recommended that you close all other applications before starting Setup.

[Files]
; ---------------------------------------------------------
; 7. Files to Install
; ---------------------------------------------------------
Source: "dist\{#AppExeName}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; ---------------------------------------------------------
; 8. Shortcuts
; ---------------------------------------------------------
Name: "{autoprograms}\{#AppName}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{autoprograms}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"

[Code]
// ---------------------------------------------------------
// 9. OTA Updater Version Marker Logic
// ---------------------------------------------------------
procedure WriteInstalledVersion;
var
  VersionFile: String;
  VersionToWrite: String;
  SetupFileName: String;
  VersionPrefix: String;
begin
  VersionToWrite := '{#AppVersion}';
  SetupFileName := ExtractFileName(ExpandConstant('{srcexe}'));
  VersionPrefix := 'RoadmapsApp_Setup-';
  if (Pos(VersionPrefix, SetupFileName) = 1) and
     (Lowercase(Copy(SetupFileName, Length(SetupFileName) - 3, 4)) = '.exe') then
    VersionToWrite := Copy(SetupFileName, Length(VersionPrefix) + 1,
      Length(SetupFileName) - Length(VersionPrefix) - 4);

  VersionFile := ExpandConstant('{localappdata}\Roadmaps App\.roadmaps_app\current_version.txt');
  if not ForceDirectories(ExtractFileDir(VersionFile)) then
    RaiseException('Could not create the RoadmapsApp version directory.');
  if not SaveStringToFile(VersionFile, VersionToWrite, False) then
    RaiseException('Could not update the RoadmapsApp version marker.');
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    WriteInstalledVersion;
end;