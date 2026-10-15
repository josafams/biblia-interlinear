# Imagem para compilar o app Android (APK de teste e AAB): a imagem de desenvolvimento + JDK 21 + Android SDK.
# Uso: docker compose run --rm android   (ou `make android`)
ARG DEV_IMAGE=biblia-interlinear-dev
FROM eclipse-temurin:21-jdk AS jdk
FROM ${DEV_IMAGE}

ENV JAVA_HOME=/opt/java/openjdk \
    ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    GRADLE_USER_HOME=/root/.gradle
ENV PATH=$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH
COPY --from=jdk /opt/java/openjdk /opt/java/openjdk

# Ferramentas de linha de comando do Android SDK e os pacotes que o projeto usa (compileSdk 36)
ARG CMDLINE_TOOLS=13114758
RUN mkdir -p $ANDROID_HOME/cmdline-tools \
 && curl -fsSL -o /tmp/tools.zip "https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS}_latest.zip" \
 && unzip -q /tmp/tools.zip -d $ANDROID_HOME/cmdline-tools \
 && mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest \
 && rm /tmp/tools.zip \
 && yes | sdkmanager --licenses > /dev/null \
 && sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" > /dev/null

CMD ["make", "android-apk"]
