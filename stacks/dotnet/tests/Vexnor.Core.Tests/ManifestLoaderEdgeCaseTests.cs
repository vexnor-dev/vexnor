using Vexnor.Core.Manifest;
using Xunit;

namespace Vexnor.Core.Tests;

/// <summary>
/// Edge-case tests for ManifestLoader covering:
/// - Invalid version rejection
/// - Generator version compatibility check
/// - Missing files in glob
/// - Multiple file merging
/// - Malformed JSON
/// </summary>
public class ManifestLoaderEdgeCaseTests
{
    // ─── Version Validation ──────────────────────────────────────────────────

    [Fact]
    public void Load_UnsupportedVersion_Throws()
    {
        var json = """{"version": 99, "queries": {}}""";

        var ex = Assert.Throws<InvalidOperationException>(() => ManifestLoader.Load(json));
        Assert.Contains("Unsupported manifest version 99", ex.Message);
        Assert.Contains(ManifestLoader.SupportedVersion.ToString(), ex.Message);
    }

    [Fact]
    public void Load_Version1_Succeeds()
    {
        var json = """{"version": 1, "queries": {}}""";

        var manifest = ManifestLoader.Load(json);
        Assert.Equal(1, manifest.Version);
        Assert.Empty(manifest.Queries);
    }

    // ─── Generator Version ───────────────────────────────────────────────────

    [Fact]
    public void Load_IncompatibleGeneratorMajorVersion_Throws()
    {
        var json = """{"version": 1, "generatorVersion": "2.0.0", "queries": {}}""";

        var ex = Assert.Throws<InvalidOperationException>(() => ManifestLoader.Load(json));
        Assert.Contains("Incompatible generator version 2.0.0", ex.Message);
        Assert.Contains($"major version {ManifestLoader.SupportedMajor}", ex.Message);
    }

    [Fact]
    public void Load_CompatibleGeneratorVersion_Succeeds()
    {
        var json = """{"version": 1, "generatorVersion": "1.5.3", "queries": {}}""";

        var manifest = ManifestLoader.Load(json);
        Assert.Equal("1.5.3", manifest.GeneratorVersion);
    }

    [Fact]
    public void Load_EmptyGeneratorVersion_Succeeds()
    {
        var json = """{"version": 1, "generatorVersion": "", "queries": {}}""";

        var manifest = ManifestLoader.Load(json);
        Assert.Equal("", manifest.GeneratorVersion);
    }

    [Fact]
    public void Load_NullGeneratorVersion_Succeeds()
    {
        var json = """{"version": 1, "queries": {}}""";

        var manifest = ManifestLoader.Load(json);
        Assert.Empty(manifest.Queries);
    }

    [Fact]
    public void Load_NonNumericGeneratorVersion_Succeeds()
    {
        // "abc.def.ghi" — first part not parseable, should not throw
        var json = """{"version": 1, "generatorVersion": "abc.def.ghi", "queries": {}}""";

        var manifest = ManifestLoader.Load(json);
        Assert.Equal("abc.def.ghi", manifest.GeneratorVersion);
    }

    // ─── LoadFile ────────────────────────────────────────────────────────────

    [Fact]
    public void LoadFile_NonexistentPath_Throws()
    {
        Assert.ThrowsAny<Exception>(() =>
            ManifestLoader.LoadFile("/nonexistent/path/manifest.json"));
    }

    [Fact]
    public void LoadFile_ValidFile_Succeeds()
    {
        var tmpFile = Path.GetTempFileName();
        try
        {
            File.WriteAllText(tmpFile, """
            {
                "version": 1,
                "queries": {
                    "h1": {
                        "name": "testQuery",
                        "hash": "h1",
                        "template": [{"type": "text", "value": "SELECT 1"}]
                    }
                }
            }
            """);

            var manifest = ManifestLoader.LoadFile(tmpFile);
            Assert.Single(manifest.Queries);
            Assert.Equal("testQuery", manifest.Queries["h1"].Name);
        }
        finally
        {
            File.Delete(tmpFile);
        }
    }

    // ─── LoadGlob ────────────────────────────────────────────────────────────

    [Fact]
    public void LoadGlob_NoFilesFound_Throws()
    {
        var tmpDir = $"{Path.GetTempPath()}{Guid.NewGuid()}";
        Directory.CreateDirectory(tmpDir);
        try
        {
            var ex = Assert.Throws<FileNotFoundException>(() =>
                ManifestLoader.LoadGlob(tmpDir, "*.json"));
            Assert.Contains("No manifest files found", ex.Message);
        }
        finally
        {
            Directory.Delete(tmpDir, true);
        }
    }

    [Fact]
    public void LoadGlob_MergesMultipleFiles()
    {
        var tmpDir = $"{Path.GetTempPath()}{Guid.NewGuid()}";
        Directory.CreateDirectory(tmpDir);
        try
        {
            File.WriteAllText(Path.Join(tmpDir, "a.json"), """
            {
                "version": 1,
                "queries": {
                    "h1": {"name": "query1", "hash": "h1", "template": [{"type": "text", "value": "SELECT 1"}]}
                }
            }
            """);

            File.WriteAllText(Path.Join(tmpDir, "b.json"), """
            {
                "version": 1,
                "queries": {
                    "h2": {"name": "query2", "hash": "h2", "template": [{"type": "text", "value": "SELECT 2"}]}
                }
            }
            """);

            var manifest = ManifestLoader.LoadGlob(tmpDir, "*.json");
            Assert.Equal(2, manifest.Queries.Count);
            Assert.True(manifest.Queries.ContainsKey("h1"));
            Assert.True(manifest.Queries.ContainsKey("h2"));
        }
        finally
        {
            Directory.Delete(tmpDir, true);
        }
    }

    [Fact]
    public void LoadGlob_LaterFileOverridesEarlier()
    {
        var tmpDir = Path.Join(Path.GetTempPath(), Guid.NewGuid().ToString());
        Directory.CreateDirectory(tmpDir);
        try
        {
            File.WriteAllText(Path.Join(tmpDir, "01_first.json"), """
            {
                "version": 1,
                "queries": {
                    "h1": {"name": "original", "hash": "h1", "template": [{"type": "text", "value": "SELECT 1"}]}
                }
            }
            """);

            File.WriteAllText(Path.Combine(tmpDir, "02_second.json"), """
            {
                "version": 1,
                "queries": {
                    "h1": {"name": "overridden", "hash": "h1", "template": [{"type": "text", "value": "SELECT 2"}]}
                }
            }
            """);

            var manifest = ManifestLoader.LoadGlob(tmpDir, "*.json");
            Assert.Single(manifest.Queries);
            Assert.Equal("overridden", manifest.Queries["h1"].Name);
        }
        finally
        {
            Directory.Delete(tmpDir, true);
        }
    }

    // ─── Malformed JSON ──────────────────────────────────────────────────────

    [Fact]
    public void Load_MalformedJson_Throws()
    {
        Assert.ThrowsAny<Exception>(() => ManifestLoader.Load("not valid json at all"));
    }

    [Fact]
    public void Load_NullJson_Throws()
    {
        // Deserializing "null" should throw our custom message
        Assert.ThrowsAny<Exception>(() => ManifestLoader.Load("null"));
    }

    // ─── LoadDirectory on registry ───────────────────────────────────────────

    [Fact]
    public void Registry_LoadDirectory_MergesFiles()
    {
        var tmpDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
        Directory.CreateDirectory(tmpDir);
        try
        {
            File.WriteAllText(Path.Combine(tmpDir, "queries.json"), """
            {
                "version": 1,
                "queries": {
                    "hash1": {"name": "dirQuery", "hash": "hash1", "template": [{"type": "text", "value": "SELECT 1"}]}
                }
            }
            """);

            var registry = new Vexnor.Core.Execution.QueryRegistry("postgresql");
            registry.LoadDirectory(tmpDir);

            Assert.Contains("hash1", registry.GetRegisteredHashes());
        }
        finally
        {
            Directory.Delete(tmpDir, true);
        }
    }

    [Fact]
    public void Registry_LoadFile_LoadsQueries()
    {
        var tmpFile = Path.GetTempFileName();
        try
        {
            File.WriteAllText(tmpFile, """
            {
                "version": 1,
                "queries": {
                    "fileHash": {"name": "fileQuery", "hash": "fileHash", "template": [{"type": "text", "value": "SELECT 1"}]}
                }
            }
            """);

            var registry = new Vexnor.Core.Execution.QueryRegistry("postgresql");
            registry.LoadFile(tmpFile);

            Assert.Contains("fileHash", registry.GetRegisteredHashes());
            Assert.Equal("fileQuery", registry.GetQuery("fileHash")!.Name);
        }
        finally
        {
            File.Delete(tmpFile);
        }
    }
}
