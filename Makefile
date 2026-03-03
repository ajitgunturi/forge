SHELL := /bin/zsh

.PHONY: release release-check

VERSION_ARG := $(word 2,$(MAKECMDGOALS))
FORWARD_ARGS := $(filter-out release release-check $(VERSION_ARG),$(MAKECMDGOALS))

release:
	@if [ -z "$(VERSION_ARG)" ]; then \
		echo "Usage: make release v1.0.0"; \
		echo "Example: make release v1.0.0"; \
		exit 1; \
	fi
	npm run release:local -- "$(VERSION_ARG)" --publish $(FORWARD_ARGS)

release-check:
	@if [ -z "$(VERSION_ARG)" ]; then \
		echo "Usage: make release-check v1.0.0"; \
		echo "Example: make release-check v1.0.0"; \
		exit 1; \
	fi
	npm run release:local -- "$(VERSION_ARG)" $(FORWARD_ARGS)

%:
	@:
