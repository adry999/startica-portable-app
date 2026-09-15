// Lansatorul nativ Startica: pornește serverul Node și fereastra browserului,
// fără VBScript/PowerShell. Înlocuiește startica_desktop.ps1 + Porneste_/Opreste_Startica.vbs.
// C# 5 / .NET Framework 4.x (compilat cu csc.exe din Windows, vezi build-launcher.ps1).
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Net;
using System.Net.NetworkInformation;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

namespace Startica
{
    internal static class Program
    {
        [STAThread]
        private static int Main(string[] args)
        {
            bool quietHint = false;
            for (int i = 0; i < args.Length; i++)
            {
                string arg = args[i];
                // --telegram/--register-task/--unregister-task implică --quiet (Options.Parse),
                // dar detecția aici trebuie să acopere și cazul unei erori de argumente înainte de Parse.
                if (string.Equals(arg, "--quiet", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(arg, "--telegram", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(arg, "--register-task", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(arg, "--unregister-task", StringComparison.OrdinalIgnoreCase))
                    quietHint = true;
            }

            Options options;
            try
            {
                options = Options.Parse(args);
            }
            catch (Exception ex)
            {
                if (!quietHint) MessageBox.Show(ex.Message, "Startica", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }

            Logger logger = null;
            try
            {
                Directory.CreateDirectory(options.Home);
                string logDirectory = Path.Combine(options.Home, "Jurnale");
                Directory.CreateDirectory(logDirectory);
                logger = new Logger(Path.Combine(logDirectory, "lansator.log"));
                logger.Info("Pornire: home=" + options.Home + " app-dir=" + options.AppDir + " port=" + options.Port +
                    (options.Stop ? " --stop" : "") +
                    (options.Telegram ? " --telegram" : "") +
                    (options.RegisterTask ? " --register-task" : "") +
                    (options.UnregisterTask ? " --unregister-task" : ""));

                return new Launcher(options, logger).Run();
            }
            catch (Exception ex)
            {
                if (logger != null) logger.Error(ex.ToString());
                if (!options.Quiet) MessageBox.Show(ex.Message, "Startica", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
        }
    }

    /// <summary>Eroare cu mesaj gata de arătat utilizatorului (română, fără stivă).</summary>
    internal sealed class StarticaException : Exception
    {
        public StarticaException(string message) : base(message) { }
    }

    internal sealed class Options
    {
        public string Home;
        public string AppDir;
        public int Port;
        public string ProfileDir;
        public bool Stop;
        public bool NoMigrate;
        public bool Quiet;
        public bool Telegram;
        public bool RegisterTask;
        public bool UnregisterTask;

        public static Options Parse(string[] args)
        {
            Options options = new Options();
            options.Home = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Startica");
            options.AppDir = Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location);
            options.Port = 8765;
            options.ProfileDir = null;

            for (int i = 0; i < args.Length; i++)
            {
                string arg = args[i];
                if (string.Equals(arg, "--home", StringComparison.OrdinalIgnoreCase)) options.Home = RequireValue(args, ref i);
                else if (string.Equals(arg, "--app-dir", StringComparison.OrdinalIgnoreCase)) options.AppDir = RequireValue(args, ref i);
                else if (string.Equals(arg, "--port", StringComparison.OrdinalIgnoreCase))
                {
                    string value = RequireValue(args, ref i);
                    int parsedPort;
                    if (!int.TryParse(value, out parsedPort) || parsedPort < 0 || parsedPort > 65535)
                        throw new StarticaException("Argument --port invalid: „" + value + "”.");
                    options.Port = parsedPort;
                }
                else if (string.Equals(arg, "--profile-dir", StringComparison.OrdinalIgnoreCase)) options.ProfileDir = RequireValue(args, ref i);
                else if (string.Equals(arg, "--stop", StringComparison.OrdinalIgnoreCase)) options.Stop = true;
                else if (string.Equals(arg, "--no-migrate", StringComparison.OrdinalIgnoreCase)) options.NoMigrate = true;
                else if (string.Equals(arg, "--quiet", StringComparison.OrdinalIgnoreCase)) options.Quiet = true;
                else if (string.Equals(arg, "--telegram", StringComparison.OrdinalIgnoreCase)) options.Telegram = true;
                else if (string.Equals(arg, "--register-task", StringComparison.OrdinalIgnoreCase)) options.RegisterTask = true;
                else if (string.Equals(arg, "--unregister-task", StringComparison.OrdinalIgnoreCase)) options.UnregisterTask = true;
                else throw new StarticaException("Argument necunoscut: " + arg);
            }

            // --stop/--telegram/--register-task/--unregister-task sunt moduri exclusive: fiecare
            // înlocuiește pornirea normală, iar combinarea lor nu are un sens definit.
            int exclusiveModes = (options.Stop ? 1 : 0) + (options.Telegram ? 1 : 0) +
                (options.RegisterTask ? 1 : 0) + (options.UnregisterTask ? 1 : 0);
            if (exclusiveModes > 1)
                throw new StarticaException("Argumentele --stop, --telegram, --register-task și --unregister-task se exclud reciproc.");
            if (options.Telegram || options.RegisterTask || options.UnregisterTask) options.Quiet = true;

            options.Home = NormalizeDirectory(options.Home);
            if (options.ProfileDir == null) options.ProfileDir = Path.Combine(options.Home, "Interfata");
            else options.ProfileDir = NormalizeDirectory(options.ProfileDir);
            return options;
        }

        private static string RequireValue(string[] args, ref int index)
        {
            if (index + 1 >= args.Length) throw new StarticaException("Lipsește valoarea pentru " + args[index] + ".");
            index++;
            return args[index];
        }

        // Path.GetFullPath nu scoate separatorul final ("C:\Home\" rămâne cu \), ceea ce
        // ar rupe compararea hash-ului de mutex și a căii bazei între două porniri cu/fără
        // separator final în --home. Rădăcina de disc ("C:\") rămâne neschimbată.
        private static string NormalizeDirectory(string path)
        {
            string full = Path.GetFullPath(path);
            if (full.Length > 3 && (full.EndsWith("\\") || full.EndsWith("/")))
                full = full.TrimEnd('\\', '/');
            return full;
        }
    }

    /// <summary>Jurnal cu timestamp ISO, rotit la 1 MB într-o singură generație (lansator.1.log).</summary>
    internal sealed class Logger
    {
        private const long MaxBytes = 1024 * 1024;
        private readonly string _path;
        private readonly object _writeLock = new object();

        public Logger(string path) { _path = path; }

        public void Info(string message) { Write("INFO", message); }
        public void Warn(string message) { Write("WARN", message); }
        public void Error(string message) { Write("ERROR", message); }

        private void Write(string level, string message)
        {
            lock (_writeLock)
            {
                RotateIfNeeded();
                string line = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ") + " " + level + " " + message + Environment.NewLine;
                File.AppendAllText(_path, line, Encoding.UTF8);
            }
        }

        private void RotateIfNeeded()
        {
            if (!File.Exists(_path)) return;
            if (new FileInfo(_path).Length < MaxBytes) return;
            string rotated = Path.Combine(Path.GetDirectoryName(_path), "lansator.1.log");
            try
            {
                if (File.Exists(rotated)) File.Delete(rotated);
                File.Move(_path, rotated);
            }
            catch (IOException)
            {
                // scrierea următoare continuă peste fișierul curent; rotația nu e critică
            }
        }
    }

    internal sealed class PortFileInfo
    {
        public readonly int Port;
        public readonly int Pid;
        public readonly string Database;
        public PortFileInfo(int port, int pid, string database) { Port = port; Pid = pid; Database = database; }
    }

    internal sealed class HealthInfo
    {
        public readonly int Port;
        public readonly string Database;
        public HealthInfo(int port, string database) { Port = port; Database = database; }
    }

    internal sealed class ShortcutInfo
    {
        public readonly string TargetPath;
        public readonly string Arguments;
        public ShortcutInfo(string targetPath, string arguments) { TargetPath = targetPath; Arguments = arguments; }
    }

    internal sealed class Launcher
    {
        private const string DatabaseRelativePath = @"Startica_Date\startica.db";
        private const string ServerScriptName = "startica_server.mjs";

        private readonly Options _options;
        private readonly Logger _logger;
        private readonly string _expectedDatabase;

        public Launcher(Options options, Logger logger)
        {
            _options = options;
            _logger = logger;
            _expectedDatabase = Path.GetFullPath(Path.Combine(_options.Home, DatabaseRelativePath));
        }

        // Codul de ieșire devine codul procesului lansator (Task Scheduler îl citește la
        // --telegram/--register-task pentru RestartOnFailure); pornirea normală rămâne 0.
        public int Run()
        {
            // Cele trei moduri de utilitate nu ating fereastra, mutexul sau migrarea:
            // rulează, scriu un rând în jurnal și ies, indiferent dacă Startica e pornită.
            if (_options.Telegram) return RunTelegramJob();
            if (_options.RegisterTask) return RunRegisterTaskCommand();
            if (_options.UnregisterTask) return RunUnregisterTaskCommand();

            if (IsDefaultHome()) CleanupOldLauncherProfiles();

            if (_options.Stop)
            {
                Stop();
                return 0;
            }

            if (!File.Exists(_expectedDatabase) && !_options.NoMigrate && !_options.Quiet)
            {
                bool proceed = RunMigration();
                if (!proceed)
                {
                    _logger.Info("Pornire anulată de utilizator la migrare.");
                    return 0;
                }
            }

            string nodePath = FindNode();
            string browserPath = FindBrowser();

            HealthInfo health = FindExistingServer();

            Mutex mutex = new Mutex(false, OwnerMutexName(_options.Home));
            bool ownsMutex = false;
            try
            {
                try { ownsMutex = mutex.WaitOne(0); }
                catch (AbandonedMutexException) { ownsMutex = true; }

                if (!ownsMutex)
                {
                    // Nu suntem proprietarul acestui home: altă instanță pornește/ține serverul.
                    if (health == null) health = WaitForHealth(10000);
                    if (health == null)
                        throw new StarticaException(
                            "Startica pornește deja, dar serverul nu răspunde încă. Închide fereastra Startica existentă și încearcă din nou.");
                    OpenWindow(browserPath, "http://127.0.0.1:" + health.Port, _options.ProfileDir);
                    _logger.Info("Fereastră deschisă (instanță neproprietară).");
                    return 0;
                }

                Process serverProcess = null;
                if (health == null)
                {
                    int port = IsPortListening(_options.Port) ? 0 : _options.Port;
                    serverProcess = StartServer(nodePath, port);
                    health = WaitForHealthOrExit(serverProcess, 15000);
                }

                OpenWindow(browserPath, "http://127.0.0.1:" + health.Port, _options.ProfileDir);
                _logger.Info("Fereastră deschisă, server pe portul " + health.Port + ".");

                // Auto-vindecare pentru home-ul implicit: o sarcină ștearsă de un "optimizator"
                // revine la prima pornire. Niciodată fatal - Startica trebuie să pornească oricum.
                if (IsDefaultHome())
                {
                    try { RegisterTelegramTask(); }
                    catch (Exception ex) { _logger.Warn("Nu am putut reînregistra sarcina Telegram: " + ex.Message); }
                }

                Supervise(browserPath);
                return 0;
            }
            finally
            {
                if (ownsMutex) { try { mutex.ReleaseMutex(); } catch (Exception) { } }
                mutex.Close();
            }
        }

        // === Sarcina Telegram (--telegram), pornită de Task Scheduler la 08:00 ===

        private int RunTelegramJob()
        {
            string nodePath = FindNode();
            string scriptPath = Path.Combine(_options.AppDir, "startica_telegram.mjs");
            ProcessStartInfo info = new ProcessStartInfo(nodePath);
            info.Arguments = "--disable-warning=ExperimentalWarning \"" + scriptPath + "\"";
            info.WorkingDirectory = _options.AppDir;
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.EnvironmentVariables["STARTICA_PROFILE"] = "production";
            info.EnvironmentVariables["STARTICA_HOME"] = _options.Home;

            Process process = Process.Start(info);
            int exitCode;
            if (process.WaitForExit(300000))
            {
                exitCode = process.ExitCode;
            }
            else
            {
                // Procesul nu are voie să rămână agățat 96 de porniri de sarcină/zi mai târziu.
                process.Kill();
                exitCode = 1;
            }
            _logger.Info("Rezumat Telegram: cod " + exitCode);
            return exitCode;
        }

        // === Sarcina programată Task Scheduler (--register-task / --unregister-task), §3.4 ===

        private const string TelegramTaskFolderName = "Startica";
        private const string TelegramTaskBaseName = "Rezumat Telegram";

        // Numele include hash-ul home-ului doar când home-ul nu e cel implicit, ca testele
        // (--home într-un folder temporar) să nu atingă sarcina reală a utilizatorului.
        private string TelegramTaskName()
        {
            if (IsDefaultHome()) return TelegramTaskBaseName;
            return TelegramTaskBaseName + " " + ComputeHomeIdentity(_options.Home).Substring(0, 8);
        }

        private int RunRegisterTaskCommand()
        {
            try
            {
                RegisterTelegramTask();
                _logger.Info("Sarcină „" + TelegramTaskName() + "” înregistrată.");
                return 0;
            }
            catch (Exception ex)
            {
                _logger.Error("Nu am putut înregistra sarcina Telegram: " + ex.Message);
                return 1;
            }
        }

        private int RunUnregisterTaskCommand()
        {
            try
            {
                UnregisterTelegramTask();
                _logger.Info("Sarcină „" + TelegramTaskName() + "” ștearsă (sau nu exista).");
            }
            catch (Exception ex)
            {
                // dezinstalarea nu are voie să eșueze din cauza sarcinii - datele rămân oricum
                _logger.Warn("Ștergerea sarcinii Telegram a eșuat: " + ex.Message);
            }
            return 0;
        }

        // Schedule.Service prin COM legat târziu, ca WScript.Shell mai jos (TryReadShortcut):
        // niciun assembly de interop dedicat. Idempotent (TASK_CREATE_OR_UPDATE), ~50 ms.
        private void RegisterTelegramTask()
        {
            dynamic scheduler = Activator.CreateInstance(Type.GetTypeFromProgID("Schedule.Service"));
            scheduler.Connect();

            dynamic rootFolder = scheduler.GetFolder("\\");
            dynamic folder = GetOrCreateTelegramFolder(rootFolder);

            dynamic taskDefinition = scheduler.NewTask(0);

            dynamic registrationInfo = taskDefinition.RegistrationInfo;
            registrationInfo.Description = "Trimite rezumatul zilnic Telegram (zile de naștere, vizite, restanțe) la ora 08:00.";
            registrationInfo.Author = "Startica";

            dynamic principal = taskDefinition.Principal;
            principal.LogonType = 3; // TASK_LOGON_INTERACTIVE_TOKEN
            principal.RunLevel = 0;  // TASK_RUNLEVEL_LUA

            dynamic settings = taskDefinition.Settings;
            settings.StartWhenAvailable = true;
            settings.DisallowStartIfOnBatteries = false;
            settings.StopIfGoingOnBatteries = false;
            settings.WakeToRun = false;
            settings.ExecutionTimeLimit = "PT10M";
            settings.MultipleInstances = 2; // TASK_INSTANCES_IGNORE_NEW
            settings.Hidden = true;
            settings.RestartCount = 6;
            settings.RestartInterval = "PT30M";

            dynamic trigger = taskDefinition.Triggers.Create(2); // TASK_TRIGGER_DAILY
            trigger.StartBoundary = DateTime.Today.AddHours(8).ToString("yyyy-MM-ddTHH:mm:ss");
            trigger.DaysInterval = 1;
            trigger.Enabled = true;

            dynamic action = taskDefinition.Actions.Create(0); // TASK_ACTION_EXEC
            action.Path = Path.Combine(_options.AppDir, "Startica.exe");
            string arguments = "--telegram --quiet";
            if (!IsDefaultHome()) arguments += " --home \"" + _options.Home + "\"";
            action.Arguments = arguments;

            folder.RegisterTaskDefinition(TelegramTaskName(), taskDefinition,
                6 /* TASK_CREATE_OR_UPDATE */, null, null, 3 /* TASK_LOGON_INTERACTIVE_TOKEN */);
        }

        // GetFolder reușește direct la a doua și următoarele porniri (calea comună, fără
        // excepție); CreateFolder rulează o singură dată, la prima înregistrare.
        private static dynamic GetOrCreateTelegramFolder(dynamic rootFolder)
        {
            try { return rootFolder.GetFolder(TelegramTaskFolderName); }
            catch (Exception) { return rootFolder.CreateFolder(TelegramTaskFolderName, null); }
        }

        private void UnregisterTelegramTask()
        {
            dynamic scheduler = Activator.CreateInstance(Type.GetTypeFromProgID("Schedule.Service"));
            scheduler.Connect();

            dynamic rootFolder = scheduler.GetFolder("\\");
            dynamic folder;
            try { folder = rootFolder.GetFolder(TelegramTaskFolderName); }
            catch (Exception) { return; } // niciun folder Startica -> nimic de șters

            try { folder.DeleteTask(TelegramTaskName(), 0); }
            catch (Exception) { /* sarcina lipsă nu e eroare */ }
        }

        private bool IsDefaultHome()
        {
            string defaultHome = Path.GetFullPath(Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Startica"));
            return string.Equals(_options.Home.TrimEnd('\\'), defaultHome.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase);
        }

        // Profilurile pe hash de cale ale lansatorului vechi (Interfata_<hash>) sunt doar cache.
        private void CleanupOldLauncherProfiles()
        {
            if (!Directory.Exists(_options.Home)) return;
            foreach (string directory in Directory.GetDirectories(_options.Home, "Interfata_*"))
            {
                try
                {
                    Directory.Delete(directory, true);
                    _logger.Info("Șters profilul vechi: " + directory);
                }
                catch (Exception ex)
                {
                    _logger.Warn("Nu am putut șterge " + directory + ": " + ex.Message);
                }
            }
        }

        // === Oprire (--stop și finalul supravegherii) ===

        // --stop = închide totul pentru acest home: fereastră, server, proces proprietar.
        private void Stop()
        {
            CloseWindows();

            // Un singur proces oprește serverul: proprietarul, când i s-a închis fereastra, sau --stop după ce proprietarul a ieșit.
            // Mutex reentrant pe același fir: dacă Stop() rulează chiar din proprietar (Supervise), WaitOne reușește imediat.
            Mutex ownerMutex = new Mutex(false, OwnerMutexName(_options.Home));
            bool acquired = false;
            try
            {
                try { acquired = ownerMutex.WaitOne(15000); }
                catch (AbandonedMutexException) { acquired = true; }
                if (!acquired) _logger.Warn("Procesul proprietar nu a ieșit în 15 s; opresc serverul direct.");
                StopServerProcess();
            }
            finally
            {
                if (acquired) { try { ownerMutex.ReleaseMutex(); } catch (Exception) { } }
                ownerMutex.Close();
            }
        }

        private void StopServerProcess()
        {
            PortFileInfo portInfo = ReadPortFileWithRetry(3, 100);
            if (portInfo == null)
            {
                _logger.Info("Niciun server pornit pentru acest home.");
                return;
            }
            if (!IsPortListening(portInfo.Port))
            {
                // Snapshot-ul GetActiveTcpListeners poate fi cu o clipă în urmă.
                Thread.Sleep(150);
                if (!IsPortListening(portInfo.Port))
                {
                    DeletePortFile();
                    _logger.Info("Niciun server pornit pentru acest home.");
                    return;
                }
            }

            HealthInfo health = TryGetHealth(portInfo.Port);
            if (health == null)
            {
                // portul ascultă, dar nu răspunde ca server Startica al nostru: fișierul e desincronizat
                DeletePortFile();
                _logger.Info("Niciun server Startica activ pentru acest home.");
                return;
            }

            string warning;
            try
            {
                string token = GetSessionToken(health.Port);
                warning = PostShutdown(health.Port, token);
            }
            catch (WebException)
            {
                // Cursa cu un alt proces care oprea deja acest server (mutexul reduce fereastra, nu o elimina).
                if (!IsPortListening(health.Port))
                {
                    _logger.Info("Serverul se oprea deja printr-un alt proces.");
                    WaitForProcessExit(portInfo.Pid, 60000);
                    _logger.Info("Server oprit.");
                    return;
                }
                throw;
            }
            if (!string.IsNullOrEmpty(warning)) _logger.Warn("Avertisment la oprire: " + warning);
            WaitForProcessExit(portInfo.Pid, 60000);
            _logger.Info("Server oprit.");
        }

        // === Serverul existent (pasul 6) ===

        private HealthInfo FindExistingServer()
        {
            PortFileInfo portInfo = ReadPortFileWithRetry(3, 100);
            if (portInfo == null) return null;
            if (!IsPortListening(portInfo.Port))
            {
                // Snapshot-ul GetActiveTcpListeners poate fi cu o clipă în urmă.
                Thread.Sleep(150);
                if (!IsPortListening(portInfo.Port))
                {
                    DeletePortFile();
                    return null;
                }
            }
            HealthInfo health = TryGetHealth(portInfo.Port);
            if (health == null)
            {
                // portul e ascultat de altcineva sau nu răspunde ca server Startica al nostru:
                // fișierul .port e desincronizat și nu are voie să blocheze pornirea (pasul 8 alege alt port).
                DeletePortFile();
                return null;
            }
            return health;
        }

        private HealthInfo WaitForHealth(int timeoutMs)
        {
            Stopwatch timer = Stopwatch.StartNew();
            int delay = 25;
            while (timer.ElapsedMilliseconds < timeoutMs)
            {
                HealthInfo health = FindExistingServer();
                if (health != null) return health;
                Thread.Sleep(delay);
                if (delay < 200) delay = Math.Min(200, delay * 2);
            }
            return null;
        }

        private HealthInfo WaitForHealthOrExit(Process serverProcess, int timeoutMs)
        {
            Stopwatch timer = Stopwatch.StartNew();
            int delay = 25;
            while (timer.ElapsedMilliseconds < timeoutMs)
            {
                // Fișierul e al serverului pornit de noi: o bază diferită e eroare reală; ștergerea l-ar lăsa orfan.
                PortFileInfo ownPortInfo = ReadPortFile();
                if (ownPortInfo != null && ownPortInfo.Pid == serverProcess.Id)
                {
                    string reportedDatabase = TryGetRunningDatabase(ownPortInfo.Port);
                    if (reportedDatabase != null && !string.Equals(reportedDatabase, _expectedDatabase, StringComparison.OrdinalIgnoreCase))
                        throw new StarticaException("Serverul a pornit, dar răspunde cu altă bază: " + reportedDatabase +
                            ". Detalii în " + Path.Combine(_options.Home, @"Jurnale\lansator.log"));
                }

                HealthInfo health = FindExistingServer();
                if (health != null) return health;
                if (serverProcess.HasExited)
                {
                    _logger.Error("node.exe s-a închis cu codul " + serverProcess.ExitCode + " înainte de a fi gata.");
                    throw new StarticaException("Serverul nu a pornit. Detalii în " +
                        Path.Combine(_options.Home, @"Jurnale\startica.log"));
                }
                Thread.Sleep(delay);
                if (delay < 200) delay = Math.Min(200, delay * 2);
            }
            if (serverProcess.HasExited)
                _logger.Error("node.exe s-a închis cu codul " + serverProcess.ExitCode + " (observat după expirarea așteptării).");
            throw new StarticaException("Pornirea durează prea mult. Verifică jurnalele din " +
                Path.Combine(_options.Home, "Jurnale"));
        }

        private Process StartServer(string nodePath, int port)
        {
            string scriptPath = Path.Combine(_options.AppDir, ServerScriptName);
            ProcessStartInfo info = new ProcessStartInfo(nodePath);
            info.Arguments = "--disable-warning=ExperimentalWarning \"" + scriptPath + "\"";
            info.WorkingDirectory = _options.AppDir;
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.EnvironmentVariables["STARTICA_PROFILE"] = "production";
            info.EnvironmentVariables["STARTICA_NO_BROWSER"] = "1";
            info.EnvironmentVariables["STARTICA_PORT"] = port.ToString();
            info.EnvironmentVariables["STARTICA_HOME"] = _options.Home;
            // Comanda și mediul complet, ca o pornire eșuată fără startica.log să fie diagnosticabilă din lansator.log.
            _logger.Info("Pornesc serverul: \"" + nodePath + "\" " + info.Arguments +
                " | WorkingDirectory=" + _options.AppDir +
                " | STARTICA_HOME=" + _options.Home +
                " | STARTICA_PORT=" + port +
                " | STARTICA_PROFILE=production | STARTICA_NO_BROWSER=1");
            return Process.Start(info);
        }

        // === Fereastra (funcție separată, ca să poată fi înlocuită cu WebView2 mai târziu) ===

        private static void OpenWindow(string browserPath, string address, string profileDir)
        {
            Directory.CreateDirectory(profileDir);
            string arguments = "--app=" + address +
                " --user-data-dir=\"" + profileDir + "\"" +
                " --new-window --no-first-run --no-default-browser-check" +
                " --disable-background-mode --disable-extensions";
            ProcessStartInfo info = new ProcessStartInfo(browserPath, arguments);
            info.UseShellExecute = true;
            Process.Start(info);
        }

        // === Supraveghere (proprietarul mutexului) ===

        private void Supervise(string browserPath)
        {
            string exeName = Path.GetFileName(browserPath);
            ManagementObject windowProcess = FindWindowProcessWithRetry(exeName, 15000);
            if (windowProcess == null)
                throw new StarticaException(
                    "Nu am putut urmări fereastra Startica. Serverul rămâne pornit și va fi refolosit la următoarea pornire.");

            while (windowProcess != null)
            {
                uint processId = (uint)windowProcess["ProcessId"];
                try
                {
                    Process handle = Process.GetProcessById((int)processId);
                    handle.WaitForExit();
                }
                catch (ArgumentException)
                {
                    // procesul s-a închis deja între interogare și așteptare
                }
                windowProcess = FindWindowProcess(exeName);
            }

            Stop();
        }

        private ManagementObject FindWindowProcessWithRetry(string exeName, int timeoutMs)
        {
            Stopwatch timer = Stopwatch.StartNew();
            ManagementObject windowProcess = null;
            while (windowProcess == null && timer.ElapsedMilliseconds < timeoutMs)
            {
                windowProcess = FindWindowProcess(exeName);
                if (windowProcess == null) Thread.Sleep(150);
            }
            return windowProcess;
        }

        private ManagementObject FindWindowProcess(string exeName)
        {
            List<ManagementObject> matches = FindAllWindowProcessesForExe(exeName);
            return matches.Count > 0 ? matches[0] : null;
        }

        // Indiferent de browser (Edge sau Chrome) - --stop nu știe cu care a pornit fereastra dacă a pornit alt lansator.
        private List<ManagementObject> FindAllWindowProcesses()
        {
            List<ManagementObject> matches = new List<ManagementObject>();
            matches.AddRange(FindAllWindowProcessesForExe("msedge.exe"));
            matches.AddRange(FindAllWindowProcessesForExe("chrome.exe"));
            return matches;
        }

        private List<ManagementObject> FindAllWindowProcessesForExe(string exeName)
        {
            List<ManagementObject> matches = new List<ManagementObject>();
            string query = "SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name = '" +
                exeName.Replace("'", "''") + "'";
            using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(query))
            {
                foreach (ManagementObject candidate in searcher.Get())
                {
                    object commandLineValue = candidate["CommandLine"];
                    string commandLine = commandLineValue == null ? null : commandLineValue.ToString();
                    if (commandLine == null) continue;
                    if (commandLine.IndexOf(_options.ProfileDir, StringComparison.OrdinalIgnoreCase) < 0) continue;
                    if (commandLine.IndexOf("--user-data-dir", StringComparison.OrdinalIgnoreCase) < 0) continue;
                    if (commandLine.IndexOf("--type=", StringComparison.OrdinalIgnoreCase) >= 0) continue;
                    matches.Add(candidate);
                }
            }
            return matches;
        }

        // Garda de modificări nesalvate din UI poate ține CloseMainWindow la infinit, de-aia urmează un Kill() după 5 s.
        private void CloseWindows()
        {
            List<ManagementObject> windows = FindAllWindowProcesses();
            if (windows.Count == 0) return;

            List<int> processIds = new List<int>();
            foreach (ManagementObject window in windows)
            {
                int processId = (int)(uint)window["ProcessId"];
                processIds.Add(processId);
                try { Process.GetProcessById(processId).CloseMainWindow(); }
                catch (ArgumentException) { /* s-a închis deja */ }
            }

            Stopwatch timer = Stopwatch.StartNew();
            while (timer.ElapsedMilliseconds < 5000 && AnyStillRunning(processIds))
                Thread.Sleep(200);

            foreach (int processId in processIds)
            {
                try
                {
                    Process process = Process.GetProcessById(processId);
                    if (!process.HasExited)
                    {
                        process.Kill();
                        _logger.Warn("Fereastra Startica (PID " + processId + ") nu s-a închis singură; a fost închisă forțat.");
                    }
                }
                catch (ArgumentException) { /* s-a închis deja */ }
                catch (InvalidOperationException) { /* s-a închis deja */ }
            }
        }

        private static bool AnyStillRunning(List<int> processIds)
        {
            foreach (int processId in processIds)
            {
                try { if (!Process.GetProcessById(processId).HasExited) return true; }
                catch (ArgumentException) { /* s-a închis deja */ }
            }
            return false;
        }

        // === Motorul și browserul ===

        private string FindNode()
        {
            string bundled = Path.Combine(_options.AppDir, @"runtime\node.exe");
            if (File.Exists(bundled)) return bundled;
            string fromPath = FindOnPath("node.exe");
            if (fromPath != null) return fromPath;
            throw new StarticaException("Lipsește motorul aplicației. Reinstalează Startica.");
        }

        private static string FindOnPath(string exeName)
        {
            string pathVariable = Environment.GetEnvironmentVariable("PATH") ?? "";
            foreach (string directory in pathVariable.Split(';'))
            {
                if (string.IsNullOrEmpty(directory)) continue;
                string candidate;
                try { candidate = Path.Combine(directory, exeName); }
                catch (ArgumentException) { continue; }
                if (File.Exists(candidate)) return candidate;
            }
            return null;
        }

        private static string FindBrowser()
        {
            string[] edgeCandidates = new string[]
            {
                CombineEnv("ProgramFiles(x86)", @"Microsoft\Edge\Application\msedge.exe"),
                CombineEnv("ProgramFiles", @"Microsoft\Edge\Application\msedge.exe"),
                ReadAppPath("msedge.exe"),
            };
            foreach (string candidate in edgeCandidates)
                if (candidate != null && File.Exists(candidate)) return candidate;

            string[] chromeCandidates = new string[]
            {
                CombineEnv("ProgramFiles", @"Google\Chrome\Application\chrome.exe"),
                CombineEnv("LOCALAPPDATA", @"Google\Chrome\Application\chrome.exe"),
                ReadAppPath("chrome.exe"),
            };
            foreach (string candidate in chromeCandidates)
                if (candidate != null && File.Exists(candidate)) return candidate;

            throw new StarticaException(
                "Startica are nevoie de Microsoft Edge sau Google Chrome. Instalează unul dintre ele și pornește din nou.");
        }

        private static string CombineEnv(string variable, string relative)
        {
            string root = Environment.GetEnvironmentVariable(variable);
            return string.IsNullOrEmpty(root) ? null : Path.Combine(root, relative);
        }

        private static string ReadAppPath(string exeName)
        {
            string subKeyPath = @"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\" + exeName;
            object value = ReadRegistryDefault(Registry.LocalMachine, subKeyPath) ??
                ReadRegistryDefault(Registry.CurrentUser, subKeyPath);
            return value == null ? null : value.ToString();
        }

        private static object ReadRegistryDefault(RegistryKey root, string subKeyPath)
        {
            using (RegistryKey key = root.OpenSubKey(subKeyPath))
            {
                return key == null ? null : key.GetValue(null);
            }
        }

        // === Fișierul .port și /api/health, /api/session, /api/shutdown ===

        private string PortFilePath()
        {
            return Path.Combine(_options.Home, "startica.port");
        }

        // Serverul scrie startica.port atomic (.tmp + rename), dar o citire chiar în jurul
        // rename-ului poate găsi fișierul lipsă/gol/JSON parțial. Câteva reîncercări scurte
        // evită să tratăm greșit un server care tocmai pornește ca "niciun server".
        private PortFileInfo ReadPortFileWithRetry(int attempts, int delayMs)
        {
            for (int attempt = 0; attempt < attempts; attempt++)
            {
                if (!File.Exists(PortFilePath())) return null;
                PortFileInfo info = ReadPortFile();
                if (info != null) return info;
                if (attempt + 1 < attempts) Thread.Sleep(delayMs);
            }
            return null;
        }

        private PortFileInfo ReadPortFile()
        {
            string path = PortFilePath();
            if (!File.Exists(path)) return null;
            string text;
            try { text = File.ReadAllText(path, Encoding.UTF8); }
            catch (IOException) { return null; }
            if (string.IsNullOrWhiteSpace(text)) return null;

            Dictionary<string, object> parsed;
            try { parsed = (Dictionary<string, object>)new JavaScriptSerializer().DeserializeObject(text); }
            catch (Exception) { return null; }
            if (parsed == null) return null;

            object portValue, pidValue, databaseValue;
            parsed.TryGetValue("port", out portValue);
            parsed.TryGetValue("pid", out pidValue);
            parsed.TryGetValue("database", out databaseValue);
            if (portValue == null || pidValue == null) return null;
            return new PortFileInfo(Convert.ToInt32(portValue), Convert.ToInt32(pidValue), databaseValue as string);
        }

        private void DeletePortFile()
        {
            string path = PortFilePath();
            try { if (File.Exists(path)) File.Delete(path); }
            catch (IOException) { }
        }

        private static bool IsPortListening(int port)
        {
            IPEndPoint[] listeners = IPGlobalProperties.GetIPGlobalProperties().GetActiveTcpListeners();
            foreach (IPEndPoint endpoint in listeners)
                if (endpoint.Port == port) return true;
            return false;
        }

        // Răspunde dacă e a noastră (database == baza așteptată); null în orice alt caz
        // (nimeni nu răspunde, sau răspunde altcineva pe acel port). Un .port vechi al cărui
        // port a fost preluat de altă aplicație nu are voie să blocheze pornirea.
        private HealthInfo TryGetHealth(int port)
        {
            string body;
            try { body = HttpGet("http://127.0.0.1:" + port + "/api/health", 2000); }
            catch (Exception) { return null; }

            Dictionary<string, object> parsed;
            try { parsed = (Dictionary<string, object>)new JavaScriptSerializer().DeserializeObject(body); }
            catch (Exception) { return null; }

            object okValue, databaseValue;
            parsed.TryGetValue("ok", out okValue);
            parsed.TryGetValue("database", out databaseValue);
            bool ok = okValue is bool && (bool)okValue;
            string database = databaseValue as string;
            if (!ok || string.IsNullOrEmpty(database))
            {
                _logger.Warn("Portul " + port + " este folosit de altă aplicație sau de altă copie Startica (răspuns neașteptat la /api/health).");
                return null;
            }

            string normalized = Path.GetFullPath(database);
            if (!string.Equals(normalized, _expectedDatabase, StringComparison.OrdinalIgnoreCase))
            {
                _logger.Warn("Portul " + port + " este folosit de altă aplicație sau de altă copie Startica (bază diferită: " + normalized + ").");
                return null;
            }

            return new HealthInfo(port, normalized);
        }

        private static string GetSessionToken(int port)
        {
            string body = HttpGet("http://127.0.0.1:" + port + "/api/session", 5000);
            Dictionary<string, object> parsed = (Dictionary<string, object>)new JavaScriptSerializer().DeserializeObject(body);
            object tokenValue;
            parsed.TryGetValue("token", out tokenValue);
            string token = tokenValue as string;
            if (string.IsNullOrEmpty(token)) throw new StarticaException("Serverul nu a răspuns cu un token de sesiune valid.");
            return token;
        }

        private static string PostShutdown(int port, string token)
        {
            byte[] payload = Encoding.UTF8.GetBytes("{}");
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/api/shutdown");
            request.Method = "POST";
            request.ContentType = "application/json";
            request.Headers["X-Startica-Token"] = token;
            request.Timeout = 60000;
            // Fără proxy/Expect: 100-continue, ca WPAD sau un round-trip suplimentar să nu
            // consume din cele 60 s de așteptare a închiderii.
            request.Proxy = null;
            request.ServicePoint.Expect100Continue = false;
            request.ContentLength = payload.Length;
            using (Stream stream = request.GetRequestStream()) stream.Write(payload, 0, payload.Length);
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            using (StreamReader reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
            {
                Dictionary<string, object> parsed =
                    (Dictionary<string, object>)new JavaScriptSerializer().DeserializeObject(reader.ReadToEnd());
                object warningValue;
                parsed.TryGetValue("warning", out warningValue);
                return warningValue as string;
            }
        }

        private static string HttpGet(string url, int timeoutMs)
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = "GET";
            request.Timeout = timeoutMs;
            // WPAD poate consuma secunde bune din fereastra de 15 s de așteptare a serverului.
            request.Proxy = null;
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            using (StreamReader reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
                return reader.ReadToEnd();
        }

        private static void WaitForProcessExit(int pid, int timeoutMs)
        {
            try { Process.GetProcessById(pid).WaitForExit(timeoutMs); }
            catch (ArgumentException) { /* procesul nu mai există - deja oprit */ }
        }

        private static string ComputeHomeIdentity(string home)
        {
            string normalized = Path.GetFullPath(home).ToLowerInvariant();
            using (SHA256 sha = SHA256.Create())
            {
                byte[] hash = sha.ComputeHash(Encoding.UTF8.GetBytes(normalized));
                StringBuilder builder = new StringBuilder();
                for (int i = 0; i < 8; i++) builder.Append(hash[i].ToString("x2"));
                return builder.ToString();
            }
        }

        // Global, nu Local: acoperă și sesiuni multiple ale aceluiași utilizator (RDP + consolă).
        private static string OwnerMutexName(string home)
        {
            return "Global\\Startica_" + ComputeHomeIdentity(home);
        }

        // === Migrarea de la instalarea veche (ZIP), secțiunea 2.5 din spec ===

        private bool RunMigration()
        {
            string candidate = FindOldInstallationCandidate();

            if (candidate == null)
            {
                DialogResult browse = MessageBox.Show(
                    "Nu am găsit nicio evidență Startica veche. Alegi folderul manual?",
                    "Startica", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
                if (browse == DialogResult.Yes)
                {
                    using (FolderBrowserDialog dialog = new FolderBrowserDialog())
                    {
                        dialog.Description = "Alege folderul instalației Startica vechi (conține Startica_Date).";
                        if (dialog.ShowDialog() == DialogResult.OK)
                        {
                            string selected = dialog.SelectedPath;
                            string nested = Path.Combine(selected, "Aplicatie");
                            if (File.Exists(Path.Combine(selected, DatabaseRelativePath)))
                                candidate = selected;
                            else if (File.Exists(Path.Combine(nested, DatabaseRelativePath)))
                                candidate = nested;
                            else
                            {
                                DialogResult emptyChoice = MessageBox.Show(
                                    "Nu am găsit nicio evidență în folderul ales. Pornesc cu o evidență goală?",
                                    "Startica", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
                                if (emptyChoice != DialogResult.Yes)
                                {
                                    _logger.Info("Pornire anulată de utilizator la migrare.");
                                    return false;
                                }
                                _logger.Info("Pornire cu evidență goală (folder ales fără evidență).");
                                return true;
                            }
                        }
                    }
                }
                if (candidate == null)
                {
                    _logger.Info("Pornire cu evidență goală (fără migrare).");
                    return true;
                }
            }

            DateTime modified = LastWriteOfDatabase(candidate);
            DialogResult confirm = MessageBox.Show(
                "Am găsit evidența Startica în: " + candidate + " (modificată la " +
                modified.ToString("dd.MM.yyyy HH:mm") + "). O preiau în noua instalare? Folderul vechi rămâne neatins.",
                "Startica", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
            if (confirm != DialogResult.Yes)
            {
                DialogResult empty = MessageBox.Show("Pornesc cu o evidență goală?",
                    "Startica", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
                if (empty == DialogResult.Yes)
                {
                    _logger.Info("Pornire cu evidență goală (migrare refuzată).");
                    return true;
                }
                _logger.Info("Pornire anulată de utilizator la migrare.");
                return false;
            }

            CopyOldInstallation(candidate);
            return true;
        }

        // WAL-ul necheckpointat poate fi mai nou decât fișierul principal .db; data arătată
        // utilizatorului trebuie să reflecte cea mai recentă scriere reală.
        private static DateTime LastWriteOfDatabase(string candidate)
        {
            string databasePath = Path.Combine(candidate, DatabaseRelativePath);
            DateTime modified = File.GetLastWriteTime(databasePath);
            string walPath = databasePath + "-wal";
            if (File.Exists(walPath))
            {
                DateTime walModified = File.GetLastWriteTime(walPath);
                if (walModified > modified) modified = walModified;
            }
            return modified;
        }

        private string FindOldInstallationCandidate()
        {
            string fromShortcut = FindCandidateFromShortcut();
            if (fromShortcut != null) return fromShortcut;

            string userProfile = Environment.GetEnvironmentVariable("USERPROFILE") ?? "";
            string documents = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
            string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            string[] candidates = new string[]
            {
                Path.Combine(documents, @"Startica\Aplicatie"),
                Path.Combine(userProfile, @"OneDrive\Documents\Startica\Aplicatie"),
                Path.Combine(userProfile, @"OneDrive\Documente\Startica\Aplicatie"),
                Path.Combine(desktop, @"Startica\Aplicatie"),
                Path.Combine(userProfile, @"Downloads\Startica\Aplicatie"),
            };
            foreach (string candidate in candidates)
                if (File.Exists(Path.Combine(candidate, DatabaseRelativePath))) return candidate;

            if (File.Exists(Path.Combine(_options.AppDir, DatabaseRelativePath))) return _options.AppDir;

            return null;
        }

        private string FindCandidateFromShortcut()
        {
            string[] shortcutPaths = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Startica.lnk"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory), "Startica.lnk"),
            };
            foreach (string shortcutPath in shortcutPaths)
            {
                ShortcutInfo shortcut = TryReadShortcut(shortcutPath);
                if (shortcut == null) continue;
                string vbsPath = ExtractVbsPath(shortcut.Arguments) ?? ExtractVbsPath(shortcut.TargetPath);
                if (vbsPath == null) continue;
                string vbsFolder = Path.GetDirectoryName(vbsPath);
                if (vbsFolder == null) continue;
                string withApplicationFolder = Path.Combine(vbsFolder, "Aplicatie");
                if (File.Exists(Path.Combine(withApplicationFolder, DatabaseRelativePath))) return withApplicationFolder;
                if (File.Exists(Path.Combine(vbsFolder, DatabaseRelativePath))) return vbsFolder;
            }
            return null;
        }

        // Folosește WScript.Shell prin COM târziu-legat (Microsoft.CSharp e deja referențiat
        // pentru `dynamic`), ca să nu fie nevoie de un assembly de interop dedicat.
        private static ShortcutInfo TryReadShortcut(string lnkPath)
        {
            if (!File.Exists(lnkPath)) return null;
            try
            {
                dynamic shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
                dynamic shortcut = shell.CreateShortcut(lnkPath);
                return new ShortcutInfo((string)shortcut.TargetPath, (string)shortcut.Arguments);
            }
            catch (Exception)
            {
                return null;
            }
        }

        private static string ExtractVbsPath(string text)
        {
            if (string.IsNullOrEmpty(text)) return null;
            Match quoted = Regex.Match(text, "\"([^\"]*Porneste_Startica\\.vbs)\"", RegexOptions.IgnoreCase);
            if (quoted.Success) return quoted.Groups[1].Value;
            Match bare = Regex.Match(text, "(\\S*Porneste_Startica\\.vbs)", RegexOptions.IgnoreCase);
            return bare.Success ? bare.Groups[1].Value : null;
        }

        private void CopyOldInstallation(string oldFolder)
        {
            string oldDatabase = Path.GetFullPath(Path.Combine(oldFolder, DatabaseRelativePath));
            string runningDatabase = TryGetRunningDatabase(8765);
            if (runningDatabase != null && string.Equals(runningDatabase, oldDatabase, StringComparison.OrdinalIgnoreCase))
                throw new StarticaException("Închide mai întâi Startica veche.");

            string sourceDataDir = Path.Combine(oldFolder, "Startica_Date");
            string targetDataDir = Path.Combine(_options.Home, "Startica_Date");
            Directory.CreateDirectory(targetDataDir);
            foreach (string suffix in new string[] { "", "-wal", "-shm" })
            {
                string sourceFile = Path.Combine(sourceDataDir, "startica.db" + suffix);
                if (File.Exists(sourceFile)) File.Copy(sourceFile, Path.Combine(targetDataDir, "startica.db" + suffix), true);
            }

            string sourceBackupDir = Path.Combine(oldFolder, "Startica_Backup");
            if (Directory.Exists(sourceBackupDir))
            {
                string targetBackupDir = Path.Combine(_options.Home, "Startica_Backup");
                Directory.CreateDirectory(targetBackupDir);
                foreach (string backupFile in Directory.GetFiles(sourceBackupDir, "startica_*.db"))
                    File.Copy(backupFile, Path.Combine(targetBackupDir, Path.GetFileName(backupFile)), true);
            }

            File.WriteAllText(Path.Combine(_options.Home, "migrat-din.txt"),
                "Sursă: " + oldFolder + Environment.NewLine +
                "Data: " + DateTime.Now.ToString("dd.MM.yyyy HH:mm:ss") + Environment.NewLine,
                Encoding.UTF8);

            try
            {
                File.WriteAllText(Path.Combine(oldFolder, "EVIDENTA MUTATA - citeste.txt"),
                    "Evidența a fost preluată în " + _options.Home + " la " +
                    DateTime.Now.ToString("dd.MM.yyyy HH:mm") + ". Acest folder poate fi șters după verificare.",
                    Encoding.UTF8);
            }
            catch (Exception)
            {
                // best-effort: folderul vechi poate fi needitabil (doar citire, sincronizare cloud)
            }

            _logger.Info("Evidență migrată din " + oldFolder);
        }

        private static string TryGetRunningDatabase(int port)
        {
            try
            {
                string body = HttpGet("http://127.0.0.1:" + port + "/api/health", 1500);
                Dictionary<string, object> parsed = (Dictionary<string, object>)new JavaScriptSerializer().DeserializeObject(body);
                object databaseValue;
                parsed.TryGetValue("database", out databaseValue);
                string database = databaseValue as string;
                return database == null ? null : Path.GetFullPath(database);
            }
            catch (Exception)
            {
                return null;
            }
        }
    }
}
