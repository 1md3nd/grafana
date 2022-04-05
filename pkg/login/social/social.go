package social

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io/ioutil"
	"net/http"
	"strconv"
	"strings"

	"context"

	"github.com/BurntSushi/toml"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	logger = log.New("social")
)

type BasicUserInfo struct {
	Id             string
	Name           string
	Email          string
	Login          string
	Company        string
	OrgMemberships map[int64]models.RoleType
	Groups         []string
	IsGrafanaAdmin *bool
}

type SocialConnector interface {
	Type() int
	UserInfo(client *http.Client, token *oauth2.Token) (*BasicUserInfo, error)
	IsEmailAllowed(email string) bool
	IsSignupAllowed() bool

	AuthCodeURL(state string, opts ...oauth2.AuthCodeOption) string
	Exchange(ctx context.Context, code string, authOptions ...oauth2.AuthCodeOption) (*oauth2.Token, error)
	Client(ctx context.Context, t *oauth2.Token) *http.Client
	TokenSource(ctx context.Context, t *oauth2.Token) oauth2.TokenSource
}

type SocialBase struct {
	*oauth2.Config
	log            log.Logger
	allowSignup    bool
	allowedDomains []string
}

type Error struct {
	s string
}

func (e Error) Error() string {
	return e.s
}

const (
	grafanaCom = "grafana_com"
)

var (
	oauthLogger   = log.New("oauth")
	SocialBaseUrl = "/login/"
	SocialMap     = make(map[string]SocialConnector)
	allOauthes    = []string{"github", "gitlab", "google", "generic_oauth", "grafananet", grafanaCom, "azuread", "okta"}
)

type Service interface {
	GetOAuthProviders() map[string]bool
	GetOAuthHttpClient(string) (*http.Client, error)
	GetConnector(string) (SocialConnector, error)
	GetOAuthInfoProvider(string) *OAuthInfo
	GetOAuthInfoProviders() map[string]*OAuthInfo
}

func newSocialBase(name string, config *oauth2.Config, info *OAuthInfo) *SocialBase {
	logger := log.New("oauth." + name)

	return &SocialBase{
		Config:         config,
		log:            logger,
		allowSignup:    info.AllowSignup,
		allowedDomains: info.AllowedDomains,
	}
}

func NewOAuthService() {
	setting.OAuthService = &setting.OAuther{}
	setting.OAuthService.OAuthInfos = make(map[string]*setting.OAuthInfo)

	for _, name := range allOauthes {
		sec := setting.Raw.Section("auth." + name)
		info := &setting.OAuthInfo{
			ClientId:           sec.Key("client_id").String(),
			ClientSecret:       sec.Key("client_secret").String(),
			Scopes:             util.SplitString(sec.Key("scopes").String()),
			AuthUrl:            sec.Key("auth_url").String(),
			TokenUrl:           sec.Key("token_url").String(),
			ApiUrl:             sec.Key("api_url").String(),
			Enabled:            sec.Key("enabled").MustBool(),
			EmailAttributeName: sec.Key("email_attribute_name").String(),
			EmailAttributePath: sec.Key("email_attribute_path").String(),
			RoleAttributePath:  sec.Key("role_attribute_path").String(),
			AllowedDomains:     util.SplitString(sec.Key("allowed_domains").String()),
			HostedDomain:       sec.Key("hosted_domain").String(),
			AllowSignup:        sec.Key("allow_sign_up").MustBool(),
			Name:               sec.Key("name").MustString(name),
			TlsClientCert:      sec.Key("tls_client_cert").String(),
			TlsClientKey:       sec.Key("tls_client_key").String(),
			TlsClientCa:        sec.Key("tls_client_ca").String(),
			TlsSkipVerify:      sec.Key("tls_skip_verify_insecure").MustBool(),
			GroupMappings:      []setting.OAuthGroupMapping{},
		}

		if !info.Enabled {
			continue
		}

		groupMappingsFile := sec.Key("group_mappings_file").String()
		if groupMappingsFile != "" {
			mappings, err := readGroupMappings(groupMappingsFile)
			if err != nil {
				oauthLogger.Error("Failed to read group mappings file", "file", groupMappingsFile, "provider", name, "error", err)
			} else {
				info.GroupMappings = mappings
			}
		}

		if name == "grafananet" {
			name = grafanaCom
		}

		setting.OAuthService.OAuthInfos[name] = info

		config := oauth2.Config{
			ClientID:     info.ClientId,
			ClientSecret: info.ClientSecret,
			Endpoint: oauth2.Endpoint{
				AuthURL:   info.AuthUrl,
				TokenURL:  info.TokenUrl,
				AuthStyle: oauth2.AuthStyleAutoDetect,
			},
			RedirectURL: strings.TrimSuffix(setting.AppUrl, "/") + SocialBaseUrl + name,
			Scopes:      info.Scopes,
		}

		// GitHub.
		if name == "github" {
			SocialMap["github"] = &SocialGithub{
				SocialBase:           newSocialBase(name, &config, info),
				apiUrl:               info.ApiUrl,
				teamIds:              sec.Key("team_ids").Ints(","),
				allowedOrganizations: util.SplitString(sec.Key("allowed_organizations").String()),
			}
		}

		// GitLab.
		if name == "gitlab" {
			SocialMap["gitlab"] = &SocialGitlab{
				SocialBase:    newSocialBase(name, &config, info),
				apiUrl:        info.ApiUrl,
				allowedGroups: util.SplitString(sec.Key("allowed_groups").String()),
			}
		}

		// Google.
		if name == "google" {
			SocialMap["google"] = &SocialGoogle{
				SocialBase:   newSocialBase(name, &config, info),
				hostedDomain: info.HostedDomain,
				apiUrl:       info.ApiUrl,
			}
		}

		// AzureAD.
		if name == "azuread" {
			SocialMap["azuread"] = &SocialAzureAD{
				SocialBase:    newSocialBase(name, &config, info),
				allowedGroups: util.SplitString(sec.Key("allowed_groups").String()),
			}
		}

		// Okta
		if name == "okta" {
			SocialMap["okta"] = &SocialOkta{
				SocialBase:        newSocialBase(name, &config, info),
				apiUrl:            info.ApiUrl,
				allowedGroups:     util.SplitString(sec.Key("allowed_groups").String()),
				roleAttributePath: info.RoleAttributePath,
			}
		}

		// Generic - Uses the same scheme as GitHub.
		if name == "generic_oauth" {
			SocialMap["generic_oauth"] = &SocialGenericOAuth{
				SocialBase:           newSocialBase(name, &config, info),
				apiUrl:               info.ApiUrl,
				emailAttributeName:   info.EmailAttributeName,
				emailAttributePath:   info.EmailAttributePath,
				nameAttributePath:    sec.Key("name_attribute_path").String(),
				roleAttributePath:    info.RoleAttributePath,
				groupMappings:        info.GroupMappings,
				loginAttributePath:   sec.Key("login_attribute_path").String(),
				idTokenAttributeName: sec.Key("id_token_attribute_name").String(),
				teamIds:              sec.Key("team_ids").Ints(","),
				allowedOrganizations: util.SplitString(sec.Key("allowed_organizations").String()),
			}
		}

		if name == grafanaCom {
			config = oauth2.Config{
				ClientID:     info.ClientId,
				ClientSecret: info.ClientSecret,
				Endpoint: oauth2.Endpoint{
					AuthURL:   setting.GrafanaComUrl + "/oauth2/authorize",
					TokenURL:  setting.GrafanaComUrl + "/api/oauth2/token",
					AuthStyle: oauth2.AuthStyleInHeader,
				},
				RedirectURL: strings.TrimSuffix(setting.AppUrl, "/") + SocialBaseUrl + name,
				Scopes:      info.Scopes,
			}

			SocialMap[grafanaCom] = &SocialGrafanaCom{
				SocialBase:           newSocialBase(name, &config, info),
				url:                  setting.GrafanaComUrl,
				allowedOrganizations: util.SplitString(sec.Key("allowed_organizations").String()),
			}
		}
	}
}

// GetOAuthProviders returns available oauth providers and if they're enabled or not
var GetOAuthProviders = func(cfg *setting.Cfg) map[string]bool {
	result := map[string]bool{}

	if ss.cfg == nil || ss.cfg.Raw == nil {
		return result
	}

	for _, name := range allOauthes {
		if name == "grafananet" {
			name = grafanaCom
		}

		sec := ss.cfg.Raw.Section("auth." + name)
		if sec == nil {
			continue
		}
		result[name] = sec.Key("enabled").MustBool()
	}

	return result
}

type OAuthGroupMapping struct {
	Filter         string
	OrgMemberships map[int64]string
	IsGrafanaAdmin *bool
}

type OAuthGroupMappingRaw struct {
	Filter         string            `toml:"filter"`
	OrgMemberships map[string]string `toml:"org_memberships"`
	IsGrafanaAdmin *bool             `toml:"grafana_admin"`
}

func readGroupMappings(configFile string) ([]setting.OAuthGroupMapping, error) {
	type oauthGroupMappingsConfig struct {
		GroupMappings []OAuthGroupMappingRaw `toml:"group_mappings"`
	}

	oauthLogger.Debug("Reading group mapping file", "file", configFile)

	result := &oauthGroupMappingsConfig{}
	_, err := toml.DecodeFile(configFile, result)
	if err != nil {
		return nil, errutil.Wrap("failed to load OAuth group mappings file", err)
	}

	if len(result.GroupMappings) == 0 {
		return nil, fmt.Errorf("OAuth enabled but no group mappings defined in config file")
	}

	groupMappings := []setting.OAuthGroupMapping{}
	for _, gm := range result.GroupMappings {
		memberships := map[int64]string{}
		for id, role := range gm.OrgMemberships {
			orgID, err := strconv.ParseInt(id, 10, 64)
			if err != nil {
				return nil, fmt.Errorf("OAuth group mapping has invalid org ID %q", id)
			}
			memberships[orgID] = role
		}
		groupMappings = append(groupMappings, setting.OAuthGroupMapping{
			Filter:         gm.Filter,
			OrgMemberships: memberships,
			IsGrafanaAdmin: gm.IsGrafanaAdmin,
		})
	}

	return groupMappings, nil
}

func GetOAuthHttpClient(name string) (*http.Client, error) {
	if setting.OAuthService == nil {
		return nil, fmt.Errorf("OAuth not enabled")
	}
	// The socialMap keys don't have "oauth_" prefix, but everywhere else in the system does
	name = strings.TrimPrefix(name, "oauth_")
	info, ok := ss.oAuthProvider[name]
	if !ok {
		return nil, fmt.Errorf("could not find %q in OAuth Settings", name)
	}

	// handle call back
	tr := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: info.TlsSkipVerify,
		},
	}
	oauthClient := &http.Client{
		Transport: tr,
	}

	if info.TlsClientCert != "" || info.TlsClientKey != "" {
		cert, err := tls.LoadX509KeyPair(info.TlsClientCert, info.TlsClientKey)
		if err != nil {
			logger.Error("Failed to setup TlsClientCert", "oauth", name, "error", err)
			return nil, fmt.Errorf("failed to setup TlsClientCert: %w", err)
		}

		tr.TLSClientConfig.Certificates = append(tr.TLSClientConfig.Certificates, cert)
	}

	if info.TlsClientCa != "" {
		caCert, err := ioutil.ReadFile(info.TlsClientCa)
		if err != nil {
			logger.Error("Failed to setup TlsClientCa", "oauth", name, "error", err)
			return nil, fmt.Errorf("failed to setup TlsClientCa: %w", err)
		}
		caCertPool := x509.NewCertPool()
		caCertPool.AppendCertsFromPEM(caCert)
		tr.TLSClientConfig.RootCAs = caCertPool
	}
	return oauthClient, nil
}
