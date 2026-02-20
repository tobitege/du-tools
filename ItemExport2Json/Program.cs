using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using System.Net.Http;
using NQutils;
using NQutils.Config;
using NQutils.Sql;
using Orleans;
using NQ.Interfaces;
using Backend;
using Backend.Business;
using NQ.Router;
using Newtonsoft.Json;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;
using System.Text.RegularExpressions;
using BotLib.Protocols;
using BotLib.Protocols.Queuing;

public static class Program
{
    public static async Task<int> Main(string[] args)
    {
        try
        {
            Action<string> log = m => { Console.WriteLine(m); Debug.WriteLine(m); };
            log("Reading config...");
            Config.ReadYamlFileFromArgs("itemexport", args);
            log("Building services...");
            var services = new ServiceCollection();
            var qurl = Environment.GetEnvironmentVariable("QUEUEING");
            if (qurl == "")
                qurl = "http://queueing:9630";
            services
                .AddSingleton<ISql, Sql>()
                .AddInitializableSingleton<IGameplayBank, GameplayBank>()
                .AddSingleton<ILocalizationManager, LocalizationManager>()
                .AddTransient<IDataAccessor, DataAccessor>()
                .AddOrleansClient("IntegrationTests")
                .AddHttpClient()
                .AddTransient<NQutils.Stats.IStats, NQutils.Stats.FakeIStats>()
                .AddSingleton<IQueuing, RealQueuing>(sp => new RealQueuing(qurl, sp.GetRequiredService<IHttpClientFactory>().CreateClient()))
                ;

            var sp = services.BuildServiceProvider();
            log("Starting services...");
            await sp.StartServices();
            log("Services started.");

            var bank = sp.GetRequiredService<IGameplayBank>();
            log("Exporting ItemBank...");
            var yaml = await bank.Export();
            log($"YAML received, length={yaml?.Length ?? 0}");
            var yamlOut = Environment.GetEnvironmentVariable("OUT_YAML");
            if (string.IsNullOrWhiteSpace(yamlOut))
                yamlOut = "itembank.yaml";
            try
            {
                var yamlFull = Path.GetFullPath(yamlOut);
                var yamlDir = Path.GetDirectoryName(yamlFull);
                if (!string.IsNullOrEmpty(yamlDir)) Directory.CreateDirectory(yamlDir);
                File.WriteAllText(yamlFull, yaml);
                log($"Wrote YAML to {yamlFull}");
            }
            catch (Exception ex)
            {
                log($"Failed to write YAML: {ex.Message}");
                throw;
            }

            var deserializer = new DeserializerBuilder()
                .WithNamingConvention(UnderscoredNamingConvention.Instance)
                .IgnoreUnmatchedProperties()
                .Build();

            var docs = new List<object>();
            var parts = Regex.Split(yaml, @"(?m)^(?:---|\.\.\.)\s*$");
            foreach (var part in parts)
            {
                if (string.IsNullOrWhiteSpace(part))
                    continue;
                using var sr = new StringReader(part);
                var doc = deserializer.Deserialize<object>(sr);
                if (doc != null)
                    docs.Add(doc);
            }
            log($"Parsed {docs.Count} YAML documents.");

            var json = JsonConvert.SerializeObject(docs, Formatting.Indented);
            var jsonOut = Environment.GetEnvironmentVariable("OUT_JSON");
            if (string.IsNullOrWhiteSpace(jsonOut))
                jsonOut = "itembank.json";
            try
            {
                var jsonFull = Path.GetFullPath(jsonOut);
                var jsonDir = Path.GetDirectoryName(jsonFull);
                if (!string.IsNullOrEmpty(jsonDir)) Directory.CreateDirectory(jsonDir);
                File.WriteAllText(jsonFull, json);
                log($"Wrote JSON to {jsonFull}");
            }
            catch (Exception ex)
            {
                log($"Failed to write JSON: {ex.Message}");
                throw;
            }

            log($"Export complete.");
            return 0;
        }
        catch (Exception e)
        {
            Console.WriteLine(e.ToString());
            Debug.WriteLine(e.ToString());
            return 1;
        }
    }
}
